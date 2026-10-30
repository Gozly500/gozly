import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { obtenirCommandesWix, obtenirMethodesPaiementWix, diagnostiquerPermissionsWix } from "@/lib/wixClient";
import { synchroniserTachesCommandes } from "@/lib/tachesCommandes";
import { correspondAuLieu } from "@/lib/wixLieu";
import { imprimerAutomatiquement } from "@/lib/impressionCommandes";
import { bornesJour, dateAujourdhui, dateEffective, decalerJour } from "@/lib/commandes";

// Champs qu'une modification faite dans Gozly protège contre l'écrasement par Wix.
const CHAMPS_MODIFIES_GOZLY = ["items", "total", "sous_total", "taxes", "client_nom", "client_telephone", "mode", "date_ramassage", "date_ramassage_fin"];

// Lit chez Wix le mode de paiement des commandes payées qui ne l'ont pas encore (20 au plus par synchro).
// Colonne absente (commandes_methode_paiement.sql pas exécuté) : on ne fait rien.
async function completerMethodesPaiement(service, entrepriseId, instanceId, lignes) {
  const payees = lignes.filter((l) => l.statut_paiement === "PAID").map((l) => l.source_id);
  if (payees.length === 0) return;
  const { data, error } = await service
    .from("commandes_en_ligne")
    .select("source_id, methode_paiement")
    .eq("entreprise_id", entrepriseId)
    .eq("source", "wix")
    .in("source_id", payees);
  if (error) return;
  const manquantes = (data || []).filter((r) => !r.methode_paiement).map((r) => r.source_id).slice(0, 20);
  if (manquantes.length === 0) return;
  const methodes = await obtenirMethodesPaiementWix(instanceId, manquantes);
  for (const [sourceId, methode] of Object.entries(methodes)) {
    await service
      .from("commandes_en_ligne")
      .update({ methode_paiement: methode })
      .eq("entreprise_id", entrepriseId)
      .eq("source", "wix")
      .eq("source_id", sourceId);
  }
}

// Copie (lecture seule) les commandes Wix récentes de l'entreprise dans
// commandes_en_ligne. Rejouable à volonté : chaque commande est mise à jour
// sur place (statut de paiement/préparation qui change, annulation...).
export async function POST(request) {
  const { entrepriseId, jours } = await request.json().catch(() => ({}));

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!entreprise) {
    return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "La synchronisation Wix n'est pas encore configurée." }, { status: 501 });
  }

  const { data: connexion } = await service
    .from("wix_connexions")
    .select("instance_id, statut")
    .eq("entreprise_id", entreprise.id)
    .maybeSingle();

  if (connexion?.statut !== "connecte" || !connexion.instance_id) {
    return NextResponse.json({ error: "Wix n'est pas connecté. Va dans Paramètres → Intégrations." }, { status: 400 });
  }

  const nbJours = Math.min(Math.max(parseInt(jours, 10) || 30, 1), 90);
  const depuis = new Date(Date.now() - nbJours * 24 * 60 * 60 * 1000).toISOString();

  let commandes;
  let nbEnLigne = 0;
  try {
    // Seulement les commandes en ligne (tout sauf le point de vente). Les
    // ventes du point de vente vont au Suivi des ventes, pas ici (voir
    // /api/ventes/synchroniser).
    commandes = await obtenirCommandesWix(connexion.instance_id, depuis, "en_ligne");
    // Un même site Wix peut alimenter plusieurs dashboards (un par succursale) :
    // on ne garde que les commandes de la succursale choisie pour celui-ci.
    commandes = commandes.filter((c) => correspondAuLieu(c, entreprise.wix_lieu_nom));
    nbEnLigne = commandes.length;
  } catch (err) {
    console.error("Erreur lecture commandes Wix:", err.message);
    // 403 = la permission "Read Orders" n'est pas (encore) accordée à l'installation.
    const permission = err.message.includes("(403)");
    let diagnostic = "";
    if (permission) {
      diagnostic = await diagnostiquerPermissionsWix(connexion.instance_id).catch(() => "");
      console.error("Diagnostic permissions Wix:", diagnostic);
    }
    return NextResponse.json(
      {
        error: permission
          ? "Gozly n'a pas la permission de lire les commandes Wix. Réinstalle l'app Gozly connect sur ton site Wix pour l'autoriser."
          : "La lecture des commandes Wix a échoué.",
        detail: diagnostic ? `${err.message} | Diagnostic: ${diagnostic}` : err.message,
      },
      { status: 502 }
    );
  }

  const lignes = commandes
    .filter((c) => c.source_id && c.date_commande)
    .map((c) => ({ ...c, entreprise_id: entreprise.id, updated_at: new Date().toISOString() }));

  // Mode d'affichage du kiosque (Personnalisation). « liste » (par défaut) : les commandes en ligne
  // arrivent déjà « Traitées » (pas d'étape « En attente »), et leur bon s'imprime à l'arrivée si
  // l'impression est activée. « sections » : elles arrivent « En attente » et l'équipe les traite.
  // Une commande déjà connue garde son étape (le upsert ne l'écrase pas), et les anciennes commandes
  // (import de l'historique) ne sont ni modifiées ni imprimées.
  const { data: reglage, error: erreurReglage } = await service
    .from("entreprises")
    .select("commandes_kiosque_mode")
    .eq("id", entreprise.id)
    .maybeSingle();
  const modeSections = !erreurReglage && reglage?.commandes_kiosque_mode === "sections";
  const aImprimer = [];

  if (lignes.length > 0) {
    const { data: connues } = await service
      .from("commandes_en_ligne")
      .select("source_id")
      .eq("entreprise_id", entreprise.id)
      .eq("source", "wix")
      .in("source_id", lignes.map((l) => l.source_id));
    const dejaConnues = new Set((connues || []).map((c) => c.source_id));
    const debutHier = bornesJour(decalerJour(dateAujourdhui(), -1)).debut;
    const il_y_a_12h = Date.now() - 12 * 3600 * 1000;
    for (const l of lignes) {
      if (dejaConnues.has(l.source_id)) continue;
      const recente = new Date(dateEffective(l)) >= new Date(debutHier);
      if (!recente) continue;
      if (!modeSections) {
        l.etape = "traitee";
        if (new Date(l.date_commande).getTime() > il_y_a_12h) aImprimer.push(l.source_id);
      } else if (l.statut_preparation === "FULFILLED") {
        // Déjà « préparée » chez Wix (éléments de menu Wix Restaurants) : nouvelle pour l'équipe, donc « En attente ».
        l.etape = "en_attente";
      }
    }
  }

  if (lignes.length > 0) {
    // Commandes annulées ou modifiées dans Gozly (commandes_annulation_modif.sql) : la synchro ne remet pas
    // le statut de Wix sur une commande annulée ici, ni les champs modifiés ici sur une commande modifiée.
    const figees = new Map();
    const { data: drapeaux, error: erreurDrapeaux } = await service
      .from("commandes_en_ligne")
      .select("source_id, annulee_gozly, modifiee_gozly")
      .eq("entreprise_id", entreprise.id)
      .eq("source", "wix")
      .in("source_id", lignes.map((l) => l.source_id));
    if (!erreurDrapeaux) for (const d of drapeaux || []) if (d.annulee_gozly || d.modifiee_gozly) figees.set(d.source_id, d);
    for (const l of lignes) {
      const f = figees.get(l.source_id);
      if (!f) continue;
      if (f.annulee_gozly) delete l.statut;
      if (f.modifiee_gozly) for (const k of CHAMPS_MODIFIES_GOZLY) delete l[k];
    }

    // Un envoi par « forme » de lignes (mêmes colonnes) : sinon une colonne présente chez une seule ligne
    // (ex: l'étape d'une nouvelle commande) viderait celle des autres.
    const parForme = new Map();
    for (const l of lignes) {
      const forme = Object.keys(l).sort().join(",");
      if (!parForme.has(forme)) parForme.set(forme, []);
      parForme.get(forme).push(l);
    }
    for (const groupe of parForme.values()) {
      let { error } = await service.from("commandes_en_ligne").upsert(groupe, { onConflict: "entreprise_id,source,source_id" });
      // Colonne du téléphone absente (commandes_telephone.sql pas exécuté) : on enregistre quand même les commandes, sans le numéro.
      if (error && /client_telephone/.test(error.message)) {
        for (const l of groupe) delete l.client_telephone;
        ({ error } = await service.from("commandes_en_ligne").upsert(groupe, { onConflict: "entreprise_id,source,source_id" }));
      }
      if (error) {
        console.error("Erreur synchronisation commandes Wix:", error.message);
        return NextResponse.json({ error: "La synchronisation a échoué.", detail: error.message }, { status: 500 });
      }
    }
  }

  // Mode de paiement des commandes payées (avant l'impression, pour qu'il figure sur le bon). Une erreur ici ne bloque rien.
  await completerMethodesPaiement(service, entreprise.id, connexion.instance_id, lignes).catch((err) =>
    console.error("Erreur mode de paiement Wix:", err.message)
  );

  // Mode liste : les bons des nouvelles commandes sortent à leur arrivée (comme quand elles deviennent « Traitées »).
  if (aImprimer.length > 0) {
    const { data: nouvelles } = await service
      .from("commandes_en_ligne")
      .select("id")
      .eq("entreprise_id", entreprise.id)
      .eq("source", "wix")
      .in("source_id", aImprimer);
    for (const n of nouvelles || []) {
      await imprimerAutomatiquement(service, entreprise.id, n.id).catch((err) => console.error("Erreur impression automatique:", err.message));
    }
  }

  // Les tâches "Réservations" suivent les commandes (nouvelles,
  // annulées, changées de date). Une erreur ici ne doit pas faire échouer la synchro.
  await synchroniserTachesCommandes(service, entreprise.id).catch((err) =>
    console.error("Erreur tâches automatiques:", err.message)
  );

  return NextResponse.json({ ok: true, count: nbEnLigne });
}
