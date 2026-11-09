// Catalogue du « magasin » d'intégrations (Paramètres > Intégrations). Une intégration « installée » apparaît dans la barre
// latérale, sous sa catégorie. Installer ne change rien au fonctionnement : c'est seulement ce que le client voit.

export const CATEGORIES_INTEGRATIONS = [
  { id: "ventes", label: "Ventes & Inventaire" },
  { id: "stockage", label: "Stockage de fichiers" },
  { id: "paie", label: "Paie" },
  { id: "ia", label: "Intelligence artificielle" },
];

export const CATALOGUE_INTEGRATIONS = [
  { id: "wix", nom: "Wix", categorie: "ventes", description: "Synchronise ton inventaire avec ta boutique Wix et reçois tes commandes en ligne.", disponible: true, teinte: "#6aa8ff" },
  { id: "shopify", nom: "Shopify", categorie: "ventes", description: "Branche ta boutique Shopify à ton inventaire.", disponible: false, teinte: "#7ee787" },
  { id: "onedrive", nom: "OneDrive", categorie: "stockage", description: "Dépose automatiquement tes fiches de température dans ton OneDrive.", disponible: true, teinte: "#4ea1ff" },
  { id: "google-drive", nom: "Google Drive", categorie: "stockage", description: "Garde tes fiches de température dans ton Google Drive.", disponible: true, teinte: "#ffd36b" },
  { id: "nethris", nom: "Nethris", categorie: "paie", description: "Exporte ta feuille de temps vers Nethris pour la paie.", disponible: true, teinte: "#b58cff" },
  { id: "dayforce", nom: "Dayforce", categorie: "paie", description: "Envoie les heures travaillées vers Dayforce.", disponible: false, teinte: "#ff9bb0" },
  { id: "quickbooks", nom: "QuickBooks", categorie: "paie", description: "Envoie la paie et les ventes vers QuickBooks.", disponible: false, teinte: "#7ee787" },
  { id: "ia-assistants", nom: "Assistants IA", categorie: "ia", description: "Branche ChatGPT, Claude... à ton entreprise, avec des permissions que tu contrôles.", disponible: true, teinte: "#ff9d5c" },
];

export function categorieDe(id) {
  return CATEGORIES_INTEGRATIONS.find((c) => c.id === id);
}

// Catégories qui ont au moins une intégration installée (seules celles-là apparaissent dans la barre latérale).
export function categoriesInstallees(installees) {
  return CATEGORIES_INTEGRATIONS.filter((c) => CATALOGUE_INTEGRATIONS.some((i) => i.categorie === c.id && installees.includes(i.id)));
}

export function sansAccents(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
