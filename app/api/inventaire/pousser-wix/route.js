import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { pousserQuantiteWix, creerProduitWix } from "@/lib/wixClient";

// Repousse la quantité d'UN produit déjà lié à Wix (source = 'wix') vers
// Wix. Appelée manuellement (bouton) ou automatiquement après une
// modification si l'entreprise a activé la synchro auto (Personnalisation).
export async function POST(request) {
  const { produitId, entrepriseId } = await request.json().catch(() => ({}));
  if (!produitId) {
    return NextResponse.json({ error: "Produit manquant." }, { status: 400 });
  }

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

  const [{ data: produit }, { data: connexion }] = await Promise.all([
    service.from("produits_inventaire").select("*").eq("id", produitId).maybeSingle(),
    service.from("wix_connexions").select("instance_id, statut").eq("entreprise_id", entreprise.id).maybeSingle(),
  ]);

  if (!produit || produit.entreprise_id !== entreprise.id) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }
  if (connexion?.statut !== "connecte" || !connexion.instance_id) {
    return NextResponse.json({ error: "Wix n'est pas connecté. Va dans Entreprise → Intégrations." }, { status: 400 });
  }

  // Produit créé dans Gozly (pas encore sur Wix) : on le crée sur Wix, puis on le lie (source = 'wix').
  if (produit.source !== "wix" || !produit.source_id) {
    if (produit.source) {
      return NextResponse.json({ error: "Ce produit vient d'une autre source." }, { status: 400 });
    }
    if (String(produit.nom).includes(" — ")) {
      return NextResponse.json(
        { error: "Les produits à variantes ne peuvent pas encore être créés sur Wix depuis Gozly : crée-les dans Wix, puis synchronise." },
        { status: 400 }
      );
    }
    if (produit.prix == null || !(Number(produit.prix) >= 0)) {
      return NextResponse.json({ error: "Ajoute d'abord un prix de vente au produit : Wix l'exige pour créer un produit." }, { status: 400 });
    }

    // Catégorie venue de Wix (collection) : le produit y sera ajouté.
    let collectionId = null;
    if (produit.categorie_id) {
      const { data: categorie, error: erreurCategorie } = await service
        .from("categories_inventaire")
        .select("source, source_id")
        .eq("id", produit.categorie_id)
        .maybeSingle();
      if (!erreurCategorie && categorie?.source === "wix") collectionId = categorie.source_id;
    }

    try {
      const { id } = await creerProduitWix(connexion.instance_id, {
        nom: produit.nom,
        prix: produit.prix,
        sku: produit.sku,
        quantite: produit.quantite,
        collectionId,
      });
      await service
        .from("produits_inventaire")
        .update({ source: "wix", source_id: `v1:${id}:`, updated_at: new Date().toISOString() })
        .eq("id", produit.id);
      return NextResponse.json({ ok: true, cree: true });
    } catch (err) {
      console.error("Erreur création produit Wix:", err.message);
      if (err.code === "PERMISSION") {
        return NextResponse.json(
          {
            error:
              "Gozly n'a pas la permission de créer des produits sur Wix. Dans dev.wix.com, ajoute la permission de gérer les produits Wix Stores à l'app Gozly connect, publie la mise à jour, puis réinstalle l'app sur ton site.",
          },
          { status: 403 }
        );
      }
      if (err.code === "CATALOGUE_V3") {
        return NextResponse.json({ error: "La création de produits n'est pas encore prise en charge pour le nouveau catalogue Wix (V3)." }, { status: 400 });
      }
      return NextResponse.json({ error: "La création du produit sur Wix a échoué.", detail: err.message }, { status: 502 });
    }
  }

  try {
    await pousserQuantiteWix(connexion.instance_id, produit.source_id, produit.quantite);
  } catch (err) {
    console.error("Erreur envoi quantité vers Wix:", err.message);
    return NextResponse.json({ error: "L'envoi vers Wix a échoué." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
