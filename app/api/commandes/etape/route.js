import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { imprimerAutomatiquement } from "@/lib/impressionCommandes";

const ETAPES = ["en_attente", "traitee", "terminee"];

// Change l'étape d'une commande (En attente / Traitée / Terminée). Passe par
// le serveur pour pouvoir déclencher des effets de bord au même endroit
// (ex: l'impression du bon de commande quand une commande devient Traitée).
export async function POST(request) {
  const { entrepriseId, commandeId, etape } = await request.json().catch(() => ({}));

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
    .select("id, source")
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

  return NextResponse.json({ ok: true });
}
