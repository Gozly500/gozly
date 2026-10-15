// Traductions anglaises du tableau de bord. Les clés sont le texte FRANÇAIS exact
// (comme dans le code) : t("Enregistrer") renvoie "Save" en anglais et le texte
// français tel quel sinon. Un texte absent d'ici reste simplement en français.
// Un fichier par zone (lib/i18n/dash/*.js) pour garder des diffs lisibles.
import shell from "@/lib/i18n/dash/shell";

export const DASH_EN = { ...shell };
