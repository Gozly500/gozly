// Catalogue du « magasin » d'intégrations (Paramètres > Intégrations). Une intégration « installée » apparaît dans la barre
// latérale, sous sa catégorie. Installer ne change rien au fonctionnement : c'est seulement ce que le client voit.

export const CATEGORIES_INTEGRATIONS = [
  { id: "ventes", label: "Ventes & Inventaire" },
  { id: "stockage", label: "Stockage de fichiers" },
  { id: "paie", label: "Paie" },
  { id: "ia", label: "Intelligence artificielle" },
];

export const CATALOGUE_INTEGRATIONS = [
  { id: "wix", nom: "Wix", categorie: "ventes", description: "Synchronise ton inventaire avec ta boutique Wix et reçois tes commandes en ligne.", disponible: true, teinte: "#3899ff", logo: "/integrations/wix.svg", logoMono: true },
  { id: "shopify", nom: "Shopify", categorie: "ventes", description: "Branche ta boutique Shopify à ton inventaire.", disponible: false, teinte: "#96bf48", logo: "/integrations/shopify.svg", logoMono: true },
  { id: "onedrive", nom: "OneDrive", categorie: "stockage", description: "Dépose automatiquement tes fiches de température dans ton OneDrive.", disponible: true, teinte: "#4ea1ff", logo: "/integrations/onedrive.svg" },
  { id: "google-drive", nom: "Google Drive", categorie: "stockage", description: "Garde tes fiches de température dans ton Google Drive.", disponible: true, teinte: "#4285f4", logo: "/integrations/googledrive.svg", logoMono: true },
  { id: "nethris", nom: "Nethris", categorie: "paie", description: "Exporte ta feuille de temps vers Nethris pour la paie.", disponible: true, teinte: "#b58cff", logo: "/integrations/nethris.png", logoPlein: true },
  { id: "dayforce", nom: "Dayforce", categorie: "paie", description: "Envoie les heures travaillées vers Dayforce.", disponible: false, teinte: "#ff9bb0", logo: "/integrations/dayforce.png", logoPlein: true },
  { id: "quickbooks", nom: "QuickBooks", categorie: "paie", description: "Envoie la paie et les ventes vers QuickBooks.", disponible: false, teinte: "#2ca01c", logo: "/integrations/quickbooks.svg", logoMono: true },
  { id: "ia-assistants", nom: "Assistants IA", categorie: "ia", description: "Branche ChatGPT, Claude... à ton entreprise, avec des permissions que tu contrôles.", disponible: true, teinte: "#ff9d5c" },
];

// Apps approuvées de développeurs, reçues du serveur avec la liste des intégrations installées.
let appsTierces = [];

export function definirAppsTierces(apps) {
  appsTierces = (apps || []).map((a) => ({
    id: `app:${a.id}`,
    nom: a.nom,
    categorie: CATEGORIES_INTEGRATIONS.some((c) => c.id === a.categorie) ? a.categorie : "ventes",
    description: a.description_courte,
    disponible: true,
    teinte: "#7aa2ff",
    logo: a.icone || null,
    logoPlein: true,
    developpeur: a.developpeur || "",
    tiers: true,
    details: a,
  }));
}

// Tout ce que le magasin peut montrer : les intégrations de Gozly, puis celles des développeurs.
export function catalogue() {
  return [...CATALOGUE_INTEGRATIONS, ...appsTierces];
}

export function categorieDe(id) {
  return CATEGORIES_INTEGRATIONS.find((c) => c.id === id);
}

// Catégories qui ont au moins une intégration installée (seules celles-là apparaissent dans la barre latérale).
export function categoriesInstallees(installees) {
  return CATEGORIES_INTEGRATIONS.filter((c) => catalogue().some((i) => i.categorie === c.id && installees.includes(i.id)));
}

export function sansAccents(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
