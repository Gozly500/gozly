// Verrouillage de la tablette (app Android du kiosque) : l'app expose un « pont » (window.GozlyAppareil) pour s'épingler.
// Hors de l'app (navigateur ordinaire), le pont n'existe pas et rien de tout ça ne se passe.

export function dansAppKiosque() {
  return typeof navigator !== "undefined" && /GozlyKiosqueApp\//.test(navigator.userAgent);
}

export function versionAppKiosque() {
  if (typeof navigator === "undefined") return null;
  const m = navigator.userAgent.match(/GozlyKiosqueApp\/([\w.\-]+)/);
  return m ? m[1] : null;
}

export function pontAppareil() {
  return typeof window !== "undefined" && window.GozlyAppareil ? window.GozlyAppareil : null;
}

// { verrouille } ou null s'il n'y a pas de pont (navigateur, ou version de l'app trop ancienne).
export function etatAppareil() {
  const pont = pontAppareil();
  if (!pont) return null;
  try {
    return JSON.parse(pont.etat());
  } catch {
    return null;
  }
}

export function verrouillerAppareil() {
  pontAppareil()?.verrouiller();
}

export function deverrouillerAppareil() {
  pontAppareil()?.deverrouiller();
}
