export const THEMES = [
  {
    id: "gozly",
    label: "Gozly (par défaut)",
    description: "Le dégradé sombre indigo/violet signature de Gozly.",
    swatch: "linear-gradient(135deg, #05051c 0%, #0b0b3a 45%, #17175f 100%)",
  },
  {
    id: "vert",
    label: "Palette verte",
    description: "Un dégradé vert émeraude, plus doux.",
    swatch: "linear-gradient(135deg, #020b08 0%, #04170f 45%, #082a1d 100%)",
  },
  {
    id: "sombre",
    label: "Sombre neutre",
    description: "Un gris anthracite neutre avec un accent bleu.",
    swatch: "linear-gradient(135deg, #050507 0%, #0d0d11 45%, #16161b 100%)",
  },
  {
    id: "sunset",
    label: "Coucher de soleil",
    description: "Un dégradé chaleureux orange/rouge.",
    swatch: "linear-gradient(135deg, #150607 0%, #2e0d0b 45%, #521a13 100%)",
  },
  {
    id: "rose",
    label: "Rose",
    description: "Un dégradé rose vif, ni pâle ni foncé.",
    swatch: "linear-gradient(135deg, #1c0615 0%, #3f0c28 45%, #66143c 100%)",
  },
  {
    id: "sobre",
    label: "Sombre",
    description: "Fond noir uni, sans dégradé ni couleur de fond.",
    swatch: "linear-gradient(135deg, #0b0b0d 0%, #0b0b0d 45%, #0b0b0d 100%)",
    sobre: true,
  },
  {
    id: "clair",
    label: "Clair",
    description: "Fond gris clair, cartes blanches, barre latérale foncée.",
    swatch: "linear-gradient(135deg, #eceef3 0%, #eceef3 45%, #eceef3 100%)",
    sobre: true,
  },
];

// Thèmes "sobres" (sans couleur de fond) : Sombre ("sobre") et Clair. Choisis via
// l'interrupteur "Couleur" (éteint), pas via la grille des thèmes colorés.
export const THEME_SOBRE = "sobre";
export const THEMES_COULEUR = THEMES.filter((t) => !t.sobre);
export const THEMES_SOBRES = THEMES.filter((t) => t.sobre);
// Accents des thèmes sobres : couleur du bouton principal, de la barre latérale et
// de la barre du bas (app mobile). "gozly" = indigo par défaut (aucun attribut).
export const ACCENTS = [
  { id: "gozly", label: "Gozly", couleur: "#3a37d1" },
  { id: "vert", label: "Vert", couleur: "#1fa86c" },
  { id: "rose", label: "Rose", couleur: "#e0407f" },
  { id: "sunset", label: "Coucher de soleil", couleur: "#e8763f" },
];
export const DEFAULT_ACCENT = "gozly";
export const THEME_ACCENT_STORAGE_KEY = "gozly-accent";
export const THEME_ACCENT_STORAGE_KEY_MOI = "gozly-accent-moi";
export function isValidAccent(id) {
  return ACCENTS.some((a) => a.id === id);
}
// Pose (ou retire, pour l'accent par défaut) data-accent sur <html>.
export function appliquerAccent(id) {
  if (typeof document === "undefined") return;
  if (isValidAccent(id) && id !== DEFAULT_ACCENT) document.documentElement.dataset.accent = id;
  else delete document.documentElement.dataset.accent;
}
export function estSobre(id) {
  return THEMES_SOBRES.some((t) => t.id === id);
}
// Dernier thème coloré utilisé - restauré quand on recoche "Couleur".
export const THEME_COULEUR_STORAGE_KEY = "gozly-theme-couleur";
export const THEME_COULEUR_STORAGE_KEY_MOI = "gozly-theme-couleur-moi";

export const DEFAULT_THEME = "gozly";
export const THEME_STORAGE_KEY = "gozly-theme";
// Clé séparée pour l'app mobile employé (/moi) - un même appareil peut
// servir à la fois au dashboard (proprio) et à l'app employé, donc on ne
// veut pas que le thème de l'un déteigne sur l'autre.
export const THEME_STORAGE_KEY_MOI = "gozly-theme-moi";
// Tablette kiosque (/kiosque) : son propre thème, mémorisé sur la tablette.
export const THEME_STORAGE_KEY_KIOSQUE = "gozly-theme-kiosque";
export const THEME_COULEUR_STORAGE_KEY_KIOSQUE = "gozly-theme-couleur-kiosque";
export const THEME_ACCENT_STORAGE_KEY_KIOSQUE = "gozly-accent-kiosque";

// [navy, indigo, purple] d'un thème, lus dans son dégradé (swatch) - sert à
// colorer la transition animée quand on change de thème.
export function couleursDuTheme(id) {
  const t = THEMES.find((th) => th.id === id);
  return t ? t.swatch.match(/#[0-9a-fA-F]{6}/g) : null;
}

export function isValidTheme(id) {
  return THEMES.some((t) => t.id === id);
}
