// Kiosque « épinglé » : la tablette reste sur un seul kiosque et ne peut plus se promener dans les autres (ni dans la liste, ni dans les réglages).
// On l'épingle seulement depuis les réglages du kiosque : tant qu'on y reste, ils restent ouverts (réglages « ouverts ») ; dès qu'on les quitte,
// la tablette va au kiosque épinglé et n'en sort plus.
// Gardé en mémoire de session seulement : pour désépingler, on quitte l'application puis on revient (sur Windows en mode borne : redémarrer).
// C'est voulu : un réglage qui survit à la fermeture ne laisserait aucune porte de sortie.

const CLE = "gozly_kiosque_epingle";
const CLE_REGLAGES = "gozly_kiosque_epingle_reglages";
const EVENEMENT = "gozly-kiosque-epingle-change";

function lire(cle) {
  try {
    return window.sessionStorage.getItem(cle) || null;
  } catch {
    return null;
  }
}

function prevenir() {
  window.dispatchEvent(new Event(EVENEMENT));
}

export function kiosqueEpingle() {
  return lire(CLE);
}

// Les réglages restent accessibles juste après l'épinglage, le temps de les quitter (voir GardeKiosqueEpingle).
export function reglagesOuverts() {
  return lire(CLE_REGLAGES) === "1";
}

export function epinglerKiosque(id) {
  try {
    window.sessionStorage.setItem(CLE, id);
    window.sessionStorage.setItem(CLE_REGLAGES, "1");
  } catch {}
  prevenir();
}

// Appelé quand on quitte les réglages : ils ne se rouvrent plus.
export function fermerReglagesEpingle() {
  try {
    window.sessionStorage.removeItem(CLE_REGLAGES);
  } catch {}
}

// Annule l'épinglage (seulement possible depuis les réglages, tant qu'on ne les a pas quittés).
export function desepinglerKiosque() {
  try {
    window.sessionStorage.removeItem(CLE);
    window.sessionStorage.removeItem(CLE_REGLAGES);
  } catch {}
  prevenir();
}

export function surChangementEpingle(fn) {
  window.addEventListener(EVENEMENT, fn);
  return () => window.removeEventListener(EVENEMENT, fn);
}
