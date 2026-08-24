import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntreprise } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { pousserQuantiteWix } from "@/lib/wixClient";

// Repousse la quantité d'UN produit déjà lié à Wix (source = 'wix') vers
// Wix. Appelée manuellement (bouton) ou automatiquement après une
// modification si l'entreprise a activé la synchro auto (Personnalisation).
export async function POST(request) {
  const { produitId } = await request.json().catch(() => ({}));
  if (!produitId) {
    return NextResponse.json({ error: "Produit manquant." }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntreprise(supabase, token);

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

  const [{ data: produit }, { data: connexion }] = await Promise.all([
    service.from("produits_inventaire").select("*").eq("id", produitId).maybeSingle(),
    service.from("wix_connexions").select("instance_id, statut").eq("entreprise_id", entreprise.id).maybeSingle(),
  ]);

  if (!produit || produit.entreprise_id !== entreprise.id) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }
  if (produit.source !== "wix" || !produit.source_id) {
    return NextResponse.json({ error: "Ce produit n'est pas lié à Wix." }, { status: 400 });
  }
  if (connexion?.statut !== "connecte" || !connexion.instance_id) {
    return NextResponse.json({ error: "Wix n'est pas connecté. Va dans Entreprise → Intégrations." }, { status: 400 });
  }

  try {
    await pousserQuantiteWix(connexion.instance_id, produit.source_id, produit.quantite);
  } catch (err) {
    console.error("Erreur envoi quantité vers Wix:", err.message);
    return NextResponse.json({ error: "L'envoi vers Wix a échoué." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
