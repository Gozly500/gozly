import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { obtenirCommandesWix, diagnostiquerPermissionsWix } from "@/lib/wixClient";
import { synchroniserTachesCommandes } from "@/lib/tachesCommandes";
import { correspondAuLieu } from "@/lib/wixLieu";
import { imprimerAutomatiquement } from "@/lib/impressionCommandes";
import { bornesJour, dateAujourdhui, dateEffective, decalerJour } from "@/lib/commandes";

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
    const { error } = await service.from("commandes_en_ligne").upsert(lignes, { onConflict: "entreprise_id,source,source_id" });
    if (error) {
      console.error("Erreur synchronisation commandes Wix:", error.message);
      return NextResponse.json({ error: "La synchronisation a échoué.", detail: error.message }, { status: 500 });
    }
  }

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
