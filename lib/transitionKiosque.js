// Passage de relais entre la liste des kiosques et le kiosque qui s'ouvre. Quand la page change, la liste disparaît d'un coup : avant
// de disparaître, elle dépose ici une « photo » de sa carte de chargement (où est chaque élément, à ce moment précis de
// l'animation), et le kiosque la reproduit au même endroit puis la fait zoomer et s'effacer. Variable de module : elle survit aux
// changements de page faits sans rechargement. Voir ListeKiosques.jsx (dépôt) et OuvertureKiosque.jsx (lecture).
let instantane = null;

export function deposerInstantane(donnees) {
  instantane = { ...donnees, le: Date.now() };
}

// Lecture SANS effet de bord (React en développement appelle deux fois l'initialisation d'un état) ; ignorée si elle est vieille
// (page ouverte autrement que par la liste). Le kiosque l'efface ensuite avec effacerInstantane().
export function lireInstantane() {
  return instantane && Date.now() - instantane.le < 20000 ? instantane : null;
}

export function effacerInstantane() {
  instantane = null;
}
