// Mode démo : le vrai tableau de bord branché sur une fausse base qui vit dans le navigateur de la personne
// (voir lib/demo/client.js). Ce petit fichier est le seul à être chargé pour tout le monde : il ne fait que lire un
// drapeau. Tout le reste (moteur, données) est chargé à la demande, seulement quand la démo est active.
//
// Tout vit dans sessionStorage (propre à l onglet) : un autre onglet retrouve le vrai site, et FERMER L ONGLET EFFACE LA DÉMO :
// rien n est gardé, ni chez Gozly ni dans le navigateur. Le rechargement de la page, lui, garde la démo en cours.
const CLE_DRAPEAU = "gozly_demo_actif";

export const CLE_DONNEES_DEMO = "gozly_demo_donnees_v1";

export function demoActif() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(CLE_DRAPEAU) === "1";
  } catch {
    return false;
  }
}

export function activerDemo() {
  try {
    window.sessionStorage.setItem(CLE_DRAPEAU, "1");
  } catch {}
}

export function quitterDemo() {
  try {
    window.sessionStorage.removeItem(CLE_DRAPEAU);
  } catch {}
}

// Y a-t-il déjà une démo enregistrée dans ce navigateur ? (pour proposer « Reprendre » ou « Recommencer »)
export function demoEnregistree() {
  try {
    return !!window.sessionStorage.getItem(CLE_DONNEES_DEMO);
  } catch {
    return false;
  }
}
