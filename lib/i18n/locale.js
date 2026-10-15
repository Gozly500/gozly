// Locale des dates/montants selon la langue courante. La valeur est posée par LangProvider
// pendant le rendu (donc identique côté serveur et côté client) ; loc() est appelée au moment
// de formater, jamais au chargement du module.
let langue = "fr";

export function setLocaleLang(l) {
  langue = l === "en" ? "en" : "fr";
}

export function loc() {
  return langue === "en" ? "en-CA" : "fr-CA";
}
