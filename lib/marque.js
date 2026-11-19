// Identité visuelle de Gozly : couleurs, polices et fichiers du kit de marque. Une seule source pour la page /marque,
// le kit téléchargeable (ZIP) et la charte graphique (PDF). Les couleurs sont celles de app/globals.css (:root).

export const COULEURS = {
  principales: [
    { id: "violet", nom: "Violet Gozly", hex: "#7a3fe0", role: "Couleur principale : boutons, accents, éléments actifs." },
    { id: "cyan", nom: "Cyan", hex: "#0cc0df", role: "Accent clair : liens, puces, début des dégradés." },
    { id: "rose", nom: "Rose", hex: "#ec4899", role: "Accent chaud : fin des dégradés, détails." },
    { id: "orange", nom: "Orange", hex: "#f2925a", role: "Accent chaud secondaire, avertissements doux." },
  ],
  fonds: [
    { id: "marine", nom: "Marine", hex: "#0d0d3f", role: "Base des surfaces foncées." },
    { id: "indigo", nom: "Indigo", hex: "#221f8a", role: "Fond des dégradés, boutons secondaires." },
    { id: "nuit", nom: "Nuit", hex: "#05051c", role: "Fond des pages (haut du dégradé)." },
    { id: "nuit-2", nom: "Nuit profonde", hex: "#17175f", role: "Fond des pages (bas du dégradé)." },
  ],
  texte: [{ id: "texte", nom: "Texte clair", hex: "#f2f0ff", role: "Texte sur fond foncé." }],
};

export const DEGRADE_SIGNATURE = ["#0cc0df", "#7a3fe0", "#ec4899"];

export const POLICES = [
  { id: "fredoka", nom: "Fredoka", usage: "Titres, nom de marque, chiffres importants", graisses: "SemiBold 600 · Bold 700", lien: "https://fonts.google.com/specimen/Fredoka" },
  { id: "inter", nom: "Inter", usage: "Texte courant, interface, formulaires", graisses: "Regular 400 · Medium 500 · SemiBold 600", lien: "https://fonts.google.com/specimen/Inter" },
];

// Fichiers du kit de marque : [chemin dans /public, chemin dans le ZIP].
export const FICHIERS_KIT = [
  ["gozly-logo.svg", "Logo/gozly-logo.svg"],
  ["gozly-app-icon.svg", "Icones-app/gozly-app-icon.svg"],
  ["gozly-gestion-icon.svg", "Icones-app/gozly-gestion-icon.svg"],
  ["icone-planning.svg", "Icones-modules/planning.svg"],
  ["icone-horaire.svg", "Icones-modules/horaire.svg"],
  ["icone-inventaire.svg", "Icones-modules/inventaire.svg"],
  ["icone-ventes.svg", "Icones-modules/ventes.svg"],
  ["icone-temperature.svg", "Icones-modules/temperature.svg"],
  ["icone-commandes.svg", "Icones-modules/commandes.svg"],
  ["icone-musique.svg", "Icones-modules/musique.svg"],
  ["marque/mascotte.png", "Mascotte/mascotte.png"],
  ["marque/pictogrammes-gozly.svg", "Pictogrammes/pictogrammes-gozly.svg"],
];

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toutesLesCouleurs() {
  return [...COULEURS.principales, ...COULEURS.fonds, ...COULEURS.texte];
}

export function lisezMoi() {
  return [
    "KIT DE MARQUE GOZLY",
    "====================",
    "",
    "Contenu :",
    "- Logo/ : le logo Gozly (SVG)",
    "- Icones-app/ : icônes des applications",
    "- Icones-modules/ : icônes des modules",
    "- Mascotte/ : la mascotte (PNG)",
    "- Pictogrammes/ : la bibliothèque de pictogrammes (SVG)",
    "- couleurs.txt : la palette",
    "",
    "Polices : Fredoka (titres) et Inter (texte), gratuites sur Google Fonts.",
    "",
    "Utilisation : ne pas déformer le logo, ne pas en changer les couleurs, garder un espace libre autour.",
    "Page de la marque : https://gozly.net/marque",
  ].join("\r\n");
}

export function couleursTxt() {
  const l = ["PALETTE GOZLY", ""];
  for (const c of toutesLesCouleurs()) l.push(`${c.nom.padEnd(16)} ${c.hex.toUpperCase()}  RGB ${rgb(c.hex).join(", ")}`);
  l.push("", `Dégradé signature : ${DEGRADE_SIGNATURE.join(" -> ")}`);
  return l.join("\r\n");
}

// Thèmes du tableau de bord (voir [data-theme] dans app/globals.css).
export const THEMES = [
  { id: "gozly", nom: "Gozly", fond: "#0d0d3f", accent: "#7a3fe0" },
  { id: "sombre", nom: "Sombre", fond: "#0a0a0d", accent: "#5b7cfa" },
  { id: "vert", nom: "Vert", fond: "#04140f", accent: "#22b573" },
  { id: "rose", nom: "Rose", fond: "#3d0f2e", accent: "#ff5c9d" },
  { id: "sunset", nom: "Sunset", fond: "#2b0f12", accent: "#f2925a" },
  { id: "clair", nom: "Clair", fond: "#eceef3", accent: "#7a3fe0" },
];
