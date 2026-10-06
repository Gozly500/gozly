import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { obtenirInventaireWix, obtenirCollectionsWix } from "@/lib/wixClient";

// Copie (lecture seule) l'inventaire Wix Stores de l'entreprise dans
// produits_inventaire, pour l'afficher au même endroit que les produits
// entrés à la main. Un re-clic met à jour quantité/nom/SKU sans jamais
// toucher au seuil d'alerte ni aux notes (propres à Gozly).
export async function POST(request) {
  const { entrepriseId } = await request.json().catch(() => ({}));

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
    return NextResponse.json({ error: "Wix n'est pas connecté. Va dans Entreprise → Intégrations." }, { status: 400 });
  }

  let items;
  try {
    items = await obtenirInventaireWix(connexion.instance_id);
  } catch (err) {
    console.error("Erreur lecture inventaire Wix:", err.message);
    return NextResponse.json({ error: "La lecture de l'inventaire Wix a échoué." }, { status: 502 });
  }

  const lignes = items.map((item) => {
    // Catalog V1 (obtenirInventaireWix) intègre déjà le nom de la variante
    // dans product.name ; Catalog V3 le renvoie séparément (variantName).
    const nomBase = item.product?.name || "Produit Wix";
    const nom = item.product?.variantName ? `${nomBase} — ${item.product.variantName}` : nomBase;

    return {
      entreprise_id: entreprise.id,
      source: "wix",
      source_id: item.id,
      nom,
      sku: item.product?.variantSku || null,
      quantite: typeof item.quantity === "number" ? item.quantity : item.inStock ? 9999 : 0,
      // Le prix n'est repris de Wix que s'il est connu : sinon on garde celui entré à la main.
      ...(item.prix != null && Number.isFinite(Number(item.prix)) ? { prix: Number(item.prix) } : {}),
      updated_at: new Date().toISOString(),
    };
  });

  if (lignes.length > 0) {
    const { error } = await service.from("produits_inventaire").upsert(lignes, { onConflict: "entreprise_id,source,source_id" });
    if (error) {
      console.error("Erreur synchronisation inventaire Wix:", error.message);
      return NextResponse.json({ error: "La synchronisation a échoué." }, { status: 500 });
    }
  }

  // Retire les produits Wix qui ne sont plus revenus dans cette
  // synchronisation (supprimés sur Wix, ou - comme lors du changement de
  // format des source_id - l'ancienne ligne devenue orpheline).
  const sourceIdsActuels = lignes.map((l) => l.source_id);
  let requeteNettoyage = service.from("produits_inventaire").delete().eq("entreprise_id", entreprise.id).eq("source", "wix");
  requeteNettoyage = sourceIdsActuels.length > 0 ? requeteNettoyage.not("source_id", "in", `(${sourceIdsActuels.join(",")})`) : requeteNettoyage;
  await requeteNettoyage;

  // Catégories : les collections Wix deviennent des catégories Gozly, et chaque produit sans catégorie reçoit celle de
  // sa collection Wix (une catégorie choisie à la main dans Gozly n'est jamais écrasée). Une erreur ici ne fait pas échouer la synchro.
  let nbCategories;
  try {
    nbCategories = await synchroniserCategories(service, entreprise.id, connexion.instance_id, items);
  } catch (err) {
    console.error("Erreur synchronisation catégories Wix:", err.message);
  }

  return NextResponse.json({ ok: true, count: lignes.length, categories: nbCategories });
}

// Retourne le nombre de catégories Wix, ou undefined si elles n'ont pas pu être lues / enregistrées
// (site en catalogue V3, permission manquante, ou inventaire_categories_wix.sql pas exécuté).
async function synchroniserCategories(service, entrepriseId, instanceId, items) {
  const collections = await obtenirCollectionsWix(instanceId);
  if (!collections) return undefined;

  const { data: existantes, error: erreurLecture } = await service
    .from("categories_inventaire")
    .select("id, source_id, ordre")
    .eq("entreprise_id", entrepriseId)
    .eq("source", "wix");
  if (erreurLecture) return undefined; // colonnes source / source_id absentes

  const connues = new Set((existantes || []).map((c) => c.source_id));
  const { data: dernieres } = await service
    .from("categories_inventaire")
    .select("ordre")
    .eq("entreprise_id", entrepriseId)
    .order("ordre", { ascending: false })
    .limit(1);
  let ordre = (dernieres?.[0]?.ordre || 0) + 1;

  const nouvelles = collections.filter((c) => !connues.has(c.id)).map((c) => ({ entreprise_id: entrepriseId, nom: c.nom, source: "wix", source_id: c.id, ordre: ordre++ }));
  if (nouvelles.length > 0) await service.from("categories_inventaire").insert(nouvelles);

  // Une collection supprimée sur Wix disparaît (ses produits repassent « Sans catégorie »).
  const idsWix = collections.map((c) => c.id);
  await service
    .from("categories_inventaire")
    .delete()
    .eq("entreprise_id", entrepriseId)
    .eq("source", "wix")
    .not("source_id", "in", `(${idsWix.length > 0 ? idsWix.join(",") : "''"})`);

  const { data: toutes } = await service.from("categories_inventaire").select("id, source_id").eq("entreprise_id", entrepriseId).eq("source", "wix");
  const categorieParCollection = new Map((toutes || []).map((c) => [c.source_id, c.id]));

  // produit Wix (source_id) -> catégorie Gozly de sa première collection connue
  const categorieParProduit = new Map();
  for (const item of items) {
    const collectionId = (item.collectionIds || []).find((id) => categorieParCollection.has(id));
    if (collectionId) categorieParProduit.set(item.id, categorieParCollection.get(collectionId));
  }

  const { data: produits } = await service.from("produits_inventaire").select("id, source_id, categorie_id").eq("entreprise_id", entrepriseId).eq("source", "wix");
  const parCategorie = new Map();
  for (const p of produits || []) {
    const categorieId = categorieParProduit.get(p.source_id);
    if (!categorieId || p.categorie_id) continue;
    if (!parCategorie.has(categorieId)) parCategorie.set(categorieId, []);
    parCategorie.get(categorieId).push(p.id);
  }
  for (const [categorieId, ids] of parCategorie) {
    await service.from("produits_inventaire").update({ categorie_id: categorieId }).in("id", ids);
  }

  return collections.length;
}
