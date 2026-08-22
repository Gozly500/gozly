import crypto from "crypto";

// Chiffrement des identifiants de connexion aux services de paie (Nethris,
// etc.) avant stockage en base. AES-256-GCM avec une clé lue depuis
// PAYROLL_ENCRYPTION_KEY (32 octets encodés en base64, générée une fois
// avec `openssl rand -base64 32` et jamais exposée côté client).
// Format stocké : "iv:authTag:ciphertext" (chaque partie en base64).

function getKey() {
  const b64 = process.env.PAYROLL_ENCRYPTION_KEY;
  if (!b64) throw new Error("PAYROLL_ENCRYPTION_KEY n'est pas configurée.");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("PAYROLL_ENCRYPTION_KEY doit faire 32 octets une fois décodée.");
  return key;
}

export function encrypt(texte) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const chiffre = Buffer.concat([cipher.update(String(texte), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), chiffre.toString("base64")].join(":");
}

export function decrypt(valeur) {
  const [ivB64, authTagB64, chiffreB64] = String(valeur).split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const clair = Buffer.concat([decipher.update(Buffer.from(chiffreB64, "base64")), decipher.final()]);
  return clair.toString("utf8");
}
