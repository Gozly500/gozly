// Kiosque « épinglé » : la tablette reste sur un seul kiosque et ne peut plus se promener dans les autres (ni dans la liste, ni dans les réglages).
// Gardé en mémoire de session seulement : pour désépingler, on quitte l'application puis on revient (sur Windows en mode borne : redémarrer).
// C'est voulu : un réglage qui survit à la fermeture ne laisserait aucune porte de sortie.

const CLE = "gozly_kiosque_epingle";
const EVENEMENT = "gozly-kiosque-epingle-change";

export function kiosqueEpingle() {
  try {
    return window.sessionStorage.getItem(CLE) || null;
  } catch {
    return null;
  }
}

export function epinglerKiosque(id) {
  try {
    window.sessionStorage.setItem(CLE, id);
  } catch {}
  window.dispatchEvent(new Event(EVENEMENT));
}

export function desepinglerKiosque() {
  try {
    window.sessionStorage.removeItem(CLE);
  } catch {}
  window.dispatchEvent(new Event(EVENEMENT));
}

export function surChangementEpingle(fn) {
  window.addEventListener(EVENEMENT, fn);
  return () => window.removeEventListener(EVENEMENT, fn);
}
