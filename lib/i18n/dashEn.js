// Traductions anglaises du tableau de bord. Les clés sont le texte FRANÇAIS exact
// (comme dans le code) : t("Enregistrer") renvoie "Save" en anglais et le texte
// français tel quel sinon. Un texte absent d'ici reste simplement en français.
// Un fichier par zone (lib/i18n/dash/*.js) pour garder des diffs lisibles.
import shell from "@/lib/i18n/dash/shell";
import horaire from "@/lib/i18n/dash/horaire";
import inventaire from "@/lib/i18n/dash/inventaire";
import taches from "@/lib/i18n/dash/taches";
import commerce from "@/lib/i18n/dash/commerce";
import entreprise from "@/lib/i18n/dash/entreprise";
import discussion from "@/lib/i18n/dash/discussion";
import titres from "@/lib/i18n/dash/titres";
import autres from "@/lib/i18n/dash/autres";

export const DASH_EN = { ...shell, ...horaire, ...inventaire, ...taches, ...commerce, ...entreprise, ...discussion, ...titres, ...autres };
