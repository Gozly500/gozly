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
];

export const DEFAULT_THEME = "gozly";
export const THEME_STORAGE_KEY = "gozly-theme";

export function isValidTheme(id) {
  return THEMES.some((t) => t.id === id);
}
