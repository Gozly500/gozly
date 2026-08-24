import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntreprise } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { obtenirInventaireWix } from "@/lib/wixClient";

// Copie (lecture seule) l'inventaire Wix Stores de l'entreprise dans
// produits_inventaire, pour l'afficher au même endroit que les produits
// entrés à la main. Un re-clic met à jour quantité/nom/SKU sans jamais
// toucher au seuil d'alerte ni aux notes (propres à Gozly).
export async function POST(request) {
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

  const { data: connexion } = await service
    .from("wix_connexions")
    .select("instance_id, statut")
    .eq("entreprise_id", entreprise.id)
    .maybeSingle();

  if (connexion?.statut !== "connecte" || !connexion.instance_id) {
    return NextResponse.json({ error: "Wix n'est pas connecté. Va dans Entreprise → Intégrations." }, { status: 400 });
  }

  let items;
  try {
    items = await obtenirInventaireWix(connexion.instance_id);
  } catch (err) {
    console.error("Erreur lecture inventaire Wix:", err.message);
    return NextResponse.json({ error: "La lecture de l'inventaire Wix a échoué." }, { status: 502 });
  }

  const lignes = items.map((item) => ({
    entreprise_id: entreprise.id,
    source: "wix",
    source_id: item.id,
    nom: item.product?.name || "Produit Wix",
    sku: item.product?.variantSku || null,
    quantite: typeof item.quantity === "number" ? item.quantity : item.inStock ? 9999 : 0,
    updated_at: new Date().toISOString(),
  }));

  if (lignes.length > 0) {
    const { error } = await service.from("produits_inventaire").upsert(lignes, { onConflict: "entreprise_id,source,source_id" });
    if (error) {
      console.error("Erreur synchronisation inventaire Wix:", error.message);
      return NextResponse.json({ error: "La synchronisation a échoué." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, count: lignes.length });
}
