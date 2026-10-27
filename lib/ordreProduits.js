// Ordre des produits de l'inventaire (colonne produits_inventaire.ordre, supabase/produits_ordre.sql).
// L'utilisateur range ses produits par glisser-déposer dans Inventaire > Produits ; le même ordre sert ensuite partout où on
// choisit un produit (catalogue du kiosque et du dashboard, liste de l'app employé). Les produits sans ordre viennent après
// ceux qui en ont un, par ordre alphabétique (comportement d'avant).
// Les variantes d'un même produit partagent le même numéro : elles restent ensemble.

export function trierProduits(liste) {
  return [...(liste || [])].sort((a, b) => {
    const oa = a.ordre ?? Infinity;
    const ob = b.ordre ?? Infinity;
    if (oa !== ob) return oa < ob ? -1 : 1;
    return String(a.nom || "").localeCompare(String(b.nom || ""), "fr", { sensitivity: "base" });
  });
}

// Lit les produits avec la colonne « ordre » ; tant que le SQL n'est pas exécuté (colonne absente), relit sans elle.
// requete(colonnes) : retourne la requête Supabase (promesse { data, error }) pour ces colonnes.
export async function lireProduitsTries(requete, colonnes) {
  let { data, error } = await requete(`${colonnes}, ordre`);
  if (error) ({ data } = await requete(colonnes));
  return trierProduits(data || []);
}
