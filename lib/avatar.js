import { PIECES } from "@/lib/avatarPieces";

// Avatars de Gozly : un petit robot composé de couches (corps, yeux, bouche, lunettes, chapeau), dessinées par l'équipe
// dans le dossier Avatard (lib/avatarPieces.js est généré à partir de ces SVG : voir scripts/genererAvatars.js).
// Un avatar est sauvegardé comme un petit objet JSON :
//   { corps: "#8A56FE", yeux: "yeux-normal", bouche: "bouche-normal", chapeau: "bonet" | null, chapeauCouleur: "#...",
//     lunettes: "lunette-ronde" | null, lunettesType: "standard" | "soleil" }

export const TOILE = { largeur: 1182, hauteur: 1772, decalageTete: 590 };

// Couleurs proposées (provisoires : à remplacer par la liste définitive de l'équipe).
export const COULEURS_CORPS = ["#8A56FE", "#5B7CFA", "#22C1DC", "#22B573", "#A6D84A", "#FFD23F", "#FF9A3C", "#FF5A64", "#FF5C9D", "#B66DFF", "#8E93A8", "#2B2B3A"];
export const COULEURS_CHAPEAU = ["#111114", "#FFFFFF", "#FF5A64", "#5B7CFA", "#22B573", "#FFD23F", "#FF9A3C", "#FF5C9D", "#8A56FE"];

const HEX = /^#[0-9a-fA-F]{6}$/;
const ids = (liste) => new Set(liste.map((p) => p.id));
const IDS = { yeux: ids(PIECES.yeux), bouche: ids(PIECES.bouche), chapeaux: ids(PIECES.chapeaux), lunettes: ids(PIECES.lunettes) };

function hash(texte) {
  let h = 0;
  for (let i = 0; i < texte.length; i++) h = (h * 31 + texte.charCodeAt(i)) >>> 0;
  return h;
}

// Avatar de départ pour quelqu'un qui n'en a pas encore : toujours le même pour un même nom.
export function avatarParDefaut(nom = "") {
  return {
    corps: COULEURS_CORPS[hash(String(nom)) % COULEURS_CORPS.length],
    yeux: "yeux-normal",
    bouche: "bouche-normal",
    chapeau: null,
    chapeauCouleur: COULEURS_CHAPEAU[0],
    lunettes: null,
    lunettesType: "standard",
  };
}

// Nettoie un avatar reçu (base de données ou client) : jamais de pièce ou de couleur inconnue.
// Retourne null si ce n'est pas un objet (l'appelant prend alors l'avatar par défaut).
export function normaliserAvatar(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const base = avatarParDefaut("");
  return {
    corps: HEX.test(v.corps) ? v.corps.toUpperCase() : base.corps,
    yeux: IDS.yeux.has(v.yeux) ? v.yeux : base.yeux,
    bouche: IDS.bouche.has(v.bouche) ? v.bouche : base.bouche,
    chapeau: IDS.chapeaux.has(v.chapeau) ? v.chapeau : null,
    chapeauCouleur: HEX.test(v.chapeauCouleur) ? v.chapeauCouleur.toUpperCase() : base.chapeauCouleur,
    lunettes: IDS.lunettes.has(v.lunettes) ? v.lunettes : null,
    lunettesType: v.lunettesType === "soleil" ? "soleil" : "standard",
  };
}

const choisir = (liste) => liste[Math.floor(Math.random() * liste.length)];

export function avatarAleatoire() {
  return {
    corps: choisir(COULEURS_CORPS),
    yeux: choisir(PIECES.yeux).id,
    bouche: choisir(PIECES.bouche).id,
    chapeau: Math.random() < 0.4 ? choisir(PIECES.chapeaux).id : null,
    chapeauCouleur: choisir(COULEURS_CHAPEAU),
    lunettes: Math.random() < 0.3 ? choisir(PIECES.lunettes).id : null,
    lunettesType: Math.random() < 0.5 ? "soleil" : "standard",
  };
}

export const pieceParId = (categorie, id) => PIECES[categorie].find((p) => p.id === id) || null;
