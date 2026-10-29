// Catalogue de la page /logiciels : les logiciels Gozly rangés par catégorie. Pour en ajouter un : une fiche dans FICHES_LOGICIELS,
// son identifiant dans une catégorie, et les textes « cata.<clé>.* » dans lib/i18n/site.js (FR et EN).
// Les textes sont des CLÉS de traduction (t("cata.texte.desc")), jamais du texte en dur.

export const CATEGORIES_LOGICIELS = [
  { id: "bureautique", titre: "cata.cat.bureautique", texte: "cata.cat.bureautique.t", logiciels: ["texte", "calky"] },
  { id: "commerce", titre: "cata.cat.commerce", texte: "cata.cat.commerce.t", logiciels: ["kiosque", "employe", "gestion"] },
  { id: "jeux", titre: "cata.cat.jeux", texte: "cata.cat.jeux.t", logiciels: ["scattegories"] },
];

// icone : image carrée ; lettre : tuile de couleur avec une lettre (si pas d'icône) ; telechargement : clé de lib/logiciels.js
// (bouton de téléchargement directement dans la carte) ; sinon un lien (lien + cta) ; etapes : étapes d'installation affichées sous la carte.
export const FICHES_LOGICIELS = {
  texte: {
    nom: "Textas",
    icone: "/logiciels/texte.svg",
    plateformes: ["cata.pf.windows"],
    acces: "cata.acces.onyx",
    desc: "cata.texte.desc",
    lien: "/telecharger#textas",
    cta: "cata.cta.decouvrir",
  },
  calky: {
    nom: "Calky",
    icone: "/logiciels/calky.svg",
    plateformes: ["cata.pf.windows"],
    acces: "cata.acces.onyx",
    desc: "cata.calky.desc",
    lien: "/telecharger#calky",
    cta: "cata.cta.decouvrir",
  },
  kiosque: {
    nom: "Gozly Kiosque",
    icone: "/icone-kiosque-512.png",
    plateformes: ["cata.pf.android", "cata.pf.tablette"],
    acces: "cata.acces.tous",
    desc: "cata.kiosque.desc",
    telechargement: "kiosque",
    etapes: ["tele.kiosque.e1", "tele.kiosque.e2", "tele.kiosque.e3", "tele.kiosque.e4"],
  },
  employe: {
    nom: "Gozly Employé",
    icone: "/gozly-app-icon.svg",
    plateformes: ["cata.pf.cellulaire"],
    acces: "cata.acces.forfait",
    desc: "cata.employe.desc",
    lien: "/moi",
    cta: "cata.cta.ouvrir",
  },
  gestion: {
    nom: "Gozly Gestion",
    icone: "/gozly-gestion-icon.svg",
    plateformes: ["cata.pf.cellulaire"],
    acces: "cata.acces.forfait",
    desc: "cata.gestion.desc",
    lien: "/gestion",
    cta: "cata.cta.ouvrir",
  },
  scattegories: {
    nom: "Scattegories",
    lettre: "S",
    plateformes: ["cata.pf.web"],
    acces: "cata.acces.gratuit",
    desc: "cata.scat.desc",
    lien: "/scattegories",
    cta: "cata.cta.jouer",
  },
};
