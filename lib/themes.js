export const THEMES = [
  {
    id: "gozly",
    label: "Gozly (par défaut)",
    description: "Le dégradé violet/indigo signature de Gozly.",
    swatch: "linear-gradient(135deg, #0d0d3f 0%, #221f8a 45%, #6b2bc4 100%)",
  },
  {
    id: "vert",
    label: "Palette verte",
    description: "Un dégradé vert émeraude, plus doux.",
    swatch: "linear-gradient(135deg, #04140f 0%, #0a3d2c 45%, #0f6b46 100%)",
  },
  {
    id: "sombre",
    label: "Sombre neutre",
    description: "Un gris anthracite neutre avec un accent bleu.",
    swatch: "linear-gradient(135deg, #0a0a0d 0%, #18181e 45%, #232329 100%)",
  },
  {
    id: "sunset",
    label: "Coucher de soleil",
    description: "Un dégradé chaleureux orange/rouge.",
    swatch: "linear-gradient(135deg, #2b0f12 0%, #7a2a1f 45%, #f2925a 100%)",
  },
  {
    id: "rose",
    label: "Rose",
    description: "Un dégradé rose vif, ni pâle ni foncé.",
    swatch: "linear-gradient(135deg, #3d0f2e 0%, #9b1f5c 45%, #ff5c9d 100%)",
  },
];

export const DEFAULT_THEME = "gozly";
export const THEME_STORAGE_KEY = "gozly-theme";
// Clé séparée pour l'app mobile employé (/moi) - un même appareil peut
// servir à la fois au dashboard (proprio) et à l'app employé, donc on ne
// veut pas que le thème de l'un déteigne sur l'autre.
export const THEME_STORAGE_KEY_MOI = "gozly-theme-moi";

// [navy, indigo, purple] d'un thème, lus dans son dégradé (swatch) - sert à
// colorer la transition animée quand on change de thème.
export function couleursDuTheme(id) {
  const t = THEMES.find((th) => th.id === id);
  return t ? t.swatch.match(/#[0-9a-fA-F]{6}/g) : null;
}

export function isValidTheme(id) {
  return THEMES.some((t) => t.id === id);
}
