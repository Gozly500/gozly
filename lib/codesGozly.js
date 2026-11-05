// Codes à 6 chiffres calculés par l'app gestion elle-même (TOTP standard : SHA-1, 6 chiffres, 30 s), comme Google Authenticator.
// La clé de la méthode « App Gozly » reste sur le téléphone (localStorage, par compte) : c'est ce qui permet à l'app gestion
// d'afficher le code à entrer sur l'écran de connexion. Le code est vérifié par Supabase comme n'importe quel code TOTP.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PREFIXE = "gozly_da_";

export const NOM_FACTEUR_APP_GOZLY = "Gozly-app";

function base32Decode(texte) {
  let bits = "";
  for (const c of String(texte).replace(/[=\s]/g, "").toUpperCase()) {
    const v = ALPHABET.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, "0");
  }
  const octets = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) octets.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(octets);
}

export async function genererCode(secret, maintenant = Date.now()) {
  const cle = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const compteur = Math.floor(maintenant / 1000 / 30);
  const tampon = new ArrayBuffer(8);
  const vue = new DataView(tampon);
  vue.setUint32(0, Math.floor(compteur / 2 ** 32));
  vue.setUint32(4, compteur >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", cle, tampon));
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, "0");
}

// Secondes restantes avant le prochain code.
export function secondesRestantes(maintenant = Date.now()) {
  return 30 - (Math.floor(maintenant / 1000) % 30);
}

export function lireSecretGozly(userId) {
  try {
    const brut = localStorage.getItem(PREFIXE + userId);
    return brut ? JSON.parse(brut) : null; // { factorId, secret }
  } catch {
    return null;
  }
}

export function stockerSecretGozly(userId, valeur) {
  try {
    localStorage.setItem(PREFIXE + userId, JSON.stringify(valeur));
    window.dispatchEvent(new Event("gozly-codes"));
  } catch {}
}

export function effacerSecretGozly(userId) {
  try {
    localStorage.removeItem(PREFIXE + userId);
    window.dispatchEvent(new Event("gozly-codes"));
  } catch {}
}
