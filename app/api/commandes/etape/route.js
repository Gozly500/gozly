import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { imprimerAutomatiquement } from "@/lib/impressionCommandes";
import { marquerCommandePrepareeWix, definirStatutWix } from "@/lib/wixClient";
import { STATUTS_WIX_ORDRE, etapeDuStatutWix, statutWixPourEtape } from "@/lib/statutsWix";

const ETAPES = ["en_attente", "traitee", "terminee"];

// Change l'étape d'une commande (En attente / Traitée / Terminée). Passe par
// le serveur pour pouvoir déclencher des effets de bord au même endroit
// (ex: l'impression du bon de commande quand une commande devient Traitée).
export async function POST(request) {
  const { entrepriseId, commandeId, etape, statutWix } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!ETAPES.includes(etape) || !commandeId) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
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
    return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  }

  const { data: commande } = await service
    .from("commandes_en_ligne")
    .select("*")
    .eq("id", commandeId)
    .eq("entreprise_id", entreprise.id)
    .maybeSingle();

  if (!commande) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  const champs = { etape, updated_at: new Date().toISOString() };
  // Une commande manuelle n'a pas de plateforme pour dire "préparée" : on
  // garde son statut de préparation cohérent avec l'étape.
  if (commande.source === "manuel") {
    champs.statut_preparation = etape === "terminee" ? "FULFILLED" : "NOT_FULFILLED";
  }

  const { error } = await service.from("commandes_en_ligne").update(champs).eq("id", commande.id);
  if (error) {
    console.error("Erreur changement d'étape commande:", error.message);
    return NextResponse.json({ error: "Impossible de changer l'étape.", detail: error.message }, { status: 500 });
  }

  // Une commande qui devient "Traitée" part à l'imprimante (si configurée).
  if (etape === "traitee") {
    await imprimerAutomatiquement(service, entreprise.id, commande.id).catch((err) =>
      console.error("Erreur impression automatique:", err.message)
    );
  }

  // Commande Wix : on met aussi à jour son statut de préparation chez Wix (sinon elle sonne encore sur leur tableau de bord).
  //  - modèle Wix du kiosque : `statutWix` est le statut voulu (Pending, Accepted, Ready, In_Delivery, Fulfilled) ;
  //  - modèle Gozly : « Traitée » prend le statut choisi dans Personnalisation (par défaut Acceptée), « Terminée » = Fulfilled.
  // Une commande sans fulfillment (Boutique) est simplement marquée préparée, comme avant.
  let wix = null;
  let avertissement = null;
  if (commande.source === "wix") {
    const { data: connexion } = await service.from("wix_connexions").select("instance_id, statut").eq("entreprise_id", entreprise.id).maybeSingle();
    if (connexion?.statut === "connecte" && connexion.instance_id) {
      const { data: reglage } = await service.from("entreprises").select("*").eq("id", entreprise.id).maybeSingle();
      const voulu = STATUTS_WIX_ORDRE.includes(statutWix) ? statutWix : statutWixPourEtape(etape, reglage?.commandes_traitee_wix);
      wix = await definirStatutWix(connexion.instance_id, commande.source_id, voulu, commande.wix_fulfillment_id || null);
      if (wix.ok) {
        const maj = { statut_wix: voulu, wix_fulfillment_id: wix.fulfillmentId };
        if (voulu === "Fulfilled") maj.statut_preparation = "FULFILLED";
        // Colonnes absentes (commandes_modele_wix.sql pas exécuté) : l'erreur est ignorée.
        await service.from("commandes_en_ligne").update(maj).eq("id", commande.id).then(() => {}, () => {});
        if (statutWix && etapeDuStatutWix(voulu) !== etape) {
          await service.from("commandes_en_ligne").update({ etape: etapeDuStatutWix(voulu) }).eq("id", commande.id);
        }
      } else if (wix.aucun) {
        if (etape !== "en_attente" && commande.statut_preparation !== "FULFILLED") {
          wix = await marquerCommandePrepareeWix(connexion.instance_id, commande.source_id, commande.brut?.lineItems || []);
          if (wix.ok) await service.from("commandes_en_ligne").update({ statut_preparation: "FULFILLED" }).eq("id", commande.id);
          else console.error("Marquer préparée chez Wix:", wix.status, wix.detail);
        }
      } else {
        console.error("Statut Wix:", wix.status, wix.detail);
        avertissement = "Wix n'a pas pu être mis à jour.";
      }
    }
  }

  return NextResponse.json({ ok: true, wix, ...(avertissement ? { avertissement } : {}) });
}
