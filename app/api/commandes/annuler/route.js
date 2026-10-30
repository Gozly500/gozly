import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { synchroniserTachesCommandes } from "@/lib/tachesCommandes";

// Annule (ou rétablit) une commande depuis Gozly. Une commande Wix reste active chez Wix (lecture seule) :
// l'annulation n'existe que dans Gozly, et `annulee_gozly` dit à la synchronisation de ne pas la remettre en état.
// Tout ce qui regarde le statut « CANCELED » (totaux, tâches de préparation, listes) la voit donc comme annulée.
export async function POST(request) {
  const { entrepriseId, commandeId, annulee } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!commandeId || typeof annulee !== "boolean") {
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
    .select("id, source, brut")
    .eq("id", commandeId)
    .eq("entreprise_id", entreprise.id)
    .maybeSingle();
  if (!commande) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  // Rétablir : le statut d'origine chez Wix (gardé dans la copie complète), sinon « approuvée ».
  const statut = annulee ? "CANCELED" : commande.source === "manuel" ? "APPROVED" : commande.brut?.status || "APPROVED";
  const { error } = await service
    .from("commandes_en_ligne")
    .update({ statut, annulee_gozly: annulee, updated_at: new Date().toISOString() })
    .eq("id", commande.id);
  if (error) {
    console.error("Erreur annulation commande:", error.message);
    return NextResponse.json(
      { error: "Impossible de changer la commande. As-tu exécuté commandes_annulation_modif.sql dans Supabase?", detail: error.message },
      { status: 500 }
    );
  }

  // Les tâches « Réservations » suivent la commande (retirées si annulée, remises si rétablie).
  await synchroniserTachesCommandes(service, entreprise.id).catch((err) => console.error("Erreur tâches automatiques:", err.message));

  return NextResponse.json({ ok: true });
}
