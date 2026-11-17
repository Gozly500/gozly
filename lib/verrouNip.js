// Verrouillage de la tablette par NIP (kiosque). Tout est gardé SUR la tablette (localStorage) : le NIP se vérifie sans connexion.
// Le NIP n'est jamais stocké en clair : seulement son empreinte (SHA-256 avec un sel propre à la tablette).
//
// Réglage enregistré : { sel, empreinte, auto: "jamais" | "fermeture" | "heure", heure: "HH:MM", dernierAuto: ms }
// État : "verrouille" ("1" quand l'écran est verrouillé : survit à un rechargement ou à un redémarrage de la tablette).

const CLE = "gozly_kiosque_verrou_nip";
const CLE_ETAT = "gozly_kiosque_verrouille";
const EVENEMENT = "gozly-verrou-change";

export const NIP_MIN = 4;
export const NIP_MAX = 6;

function lire() {
  try {
    const brut = window.localStorage.getItem(CLE);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

function ecrire(reglage) {
  try {
    if (reglage) window.localStorage.setItem(CLE, JSON.stringify(reglage));
    else window.localStorage.removeItem(CLE);
  } catch {}
  prevenir();
}

function prevenir() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT));
}

export function surChangementVerrou(fn) {
  window.addEventListener(EVENEMENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENEMENT, fn);
    window.removeEventListener("storage", fn);
  };
}

async function empreinte(nip, sel) {
  const texte = `${sel}:${nip}`;
  try {
    if (window.crypto?.subtle) {
      const octets = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
      return Array.from(new Uint8Array(octets)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {}
  // Navigateur sans crypto.subtle (page hors https) : empreinte simple, mieux que du clair.
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return `s${h}`;
}

function selAleatoire() {
  const a = new Uint8Array(12);
  window.crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function nipValide(nip) {
  return /^\d+$/.test(nip) && nip.length >= NIP_MIN && nip.length <= NIP_MAX;
}

export function reglageVerrou() {
  const r = lire();
  return r?.empreinte ? { auto: r.auto || "jamais", heure: r.heure || "22:00", dernierAuto: r.dernierAuto || 0 } : null;
}

// Nombre de chiffres du NIP (le bon NIP ouvre dès qu'il est complet).
export function longueurNip() {
  return lire()?.longueur || 4;
}

export function nipDefini() {
  return !!lire()?.empreinte;
}

export async function verifierNip(nip) {
  const r = lire();
  if (!r?.empreinte) return false;
  return (await empreinte(nip, r.sel)) === r.empreinte;
}

// Définit (ou remplace) le NIP. Garde les autres réglages.
export async function definirNip(nip) {
  const ancien = lire() || {};
  const sel = selAleatoire();
  ecrire({ ...ancien, sel, empreinte: await empreinte(nip, sel), longueur: nip.length, auto: ancien.auto || "jamais", heure: ancien.heure || "22:00", dernierAuto: Date.now() });
}

export function modifierReglageAuto({ auto, heure }) {
  const r = lire();
  if (!r?.empreinte) return;
  ecrire({ ...r, ...(auto ? { auto } : {}), ...(heure ? { heure } : {}), dernierAuto: Date.now() });
}

// Retire le NIP et déverrouille (aussi quand on change de compte : le NIP est celui de la tablette de ce commerce).
export function effacerVerrouNip() {
  try {
    window.localStorage.removeItem(CLE);
    window.localStorage.removeItem(CLE_ETAT);
  } catch {}
  prevenir();
}

export function estVerrouille() {
  try {
    return nipDefini() && window.localStorage.getItem(CLE_ETAT) === "1";
  } catch {
    return false;
  }
}

export function verrouiller() {
  if (!nipDefini()) return;
  try {
    window.localStorage.setItem(CLE_ETAT, "1");
  } catch {}
  prevenir();
}

export function deverrouiller() {
  try {
    window.localStorage.removeItem(CLE_ETAT);
  } catch {}
  prevenir();
}

// Verrouillage automatique : à chaque appel, verrouille si une heure de verrouillage (fermeture du magasin, ou heure choisie) est passée
// depuis la dernière fois. `derniereFermeture` = ms de la plus récente fermeture (null si pas d'horaire). Rend true si l'écran vient d'être verrouillé.
export function verifierVerrouAuto({ derniereFermeture = null, maintenant = Date.now() } = {}) {
  const r = lire();
  if (!r?.empreinte || r.auto === "jamais") return false;
  let moment = null;
  if (r.auto === "fermeture") moment = derniereFermeture;
  else if (r.auto === "heure") {
    const [hh, mm] = String(r.heure || "22:00").split(":").map(Number);
    const d = new Date(maintenant);
    d.setHours(hh || 0, mm || 0, 0, 0);
    if (d.getTime() > maintenant) d.setDate(d.getDate() - 1);
    moment = d.getTime();
  }
  if (!moment || moment > maintenant) return false;
  if (moment <= (r.dernierAuto || 0)) return false;
  ecrire({ ...r, dernierAuto: maintenant });
  verrouiller();
  return true;
}
