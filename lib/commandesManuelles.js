// Aides partagées pour construire une commande saisie à la main à partir des
// produits de l'inventaire (formulaire de l'app employé ; le formulaire du
// dashboard a ses propres copies de ces deux premières fonctions).

import { bornesJour } from "@/lib/commandes";

// Un produit de l'inventaire Wix en variante s'appelle "Produit — Variante" : on
// sépare le nom du produit et la variante pour que la commande manuelle ait la
// même forme qu'une commande Wix (nom + option).
export function separerVariante(nomComplet) {
  const [base, ...reste] = String(nomComplet).split(" — ");
  return reste.length > 0 ? { nom: base.trim(), options: [reste.join(" — ").trim()] } : { nom: base.trim(), options: [] };
}

// Id du produit chez Wix (catalogue V1: "v1:<produit>:<variante>").
export function produitIdWix(produit) {
  if (produit.source === "wix" && produit.source_id?.startsWith("v1:")) return produit.source_id.split(":")[1];
  return null;
}

// Date ("AAAA-MM-JJ") + heure ("HH:MM") saisies, heure du Québec -> instant ISO UTC.
export function versIsoQuebec(date, heure) {
  const [h, m] = (heure || "12:00").split(":").map(Number);
  return new Date(new Date(bornesJour(date).debut).getTime() + ((h || 0) * 60 + (m || 0)) * 60000).toISOString();
}
