import crypto from "crypto";

// État OAuth signé (HMAC) : relie le retour du fournisseur (Microsoft, Google) à l'entreprise qui a cliqué sur « Connecter ».
// Expire après 10 minutes ; aucune table nécessaire.

function cleSignature() {
  const cle = process.env.PAYROLL_ENCRYPTION_KEY;
  if (!cle) throw new Error("PAYROLL_ENCRYPTION_KEY n'est pas configurée.");
  return cle;
}

export function signerEtat(donnees) {
  const corps = Buffer.from(JSON.stringify({ ...donnees, exp: Date.now() + 10 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", cleSignature()).update(corps).digest("base64url");
  return `${corps}.${signature}`;
}

export function lireEtat(etat) {
  const [corps, signature] = String(etat || "").split(".");
  if (!corps || !signature) return null;
  const attendue = crypto.createHmac("sha256", cleSignature()).update(corps).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(attendue);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const donnees = JSON.parse(Buffer.from(corps, "base64url").toString("utf8"));
    return donnees.exp > Date.now() ? donnees : null;
  } catch {
    return null;
  }
}
