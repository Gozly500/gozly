import crypto from "crypto";

// Jeton envoyé à la page de gestion d'une app (paramètre « jeton »). JWT HS256, valide 5 minutes, signé avec la clé de l'app
// (secret_page, visible seulement par son développeur). Le développeur le vérifie pour savoir QUELLE entreprise ouvre sa page.
const b64 = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");

export function signerJeton({ secret, appId, entrepriseId, entrepriseNom, apercu = false }) {
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = b64({ alg: "HS256", typ: "JWT" });
  const corps = b64({
    iss: "gozly.net",
    aud: appId,
    sub: entrepriseId,
    entreprise: entrepriseNom || "",
    apercu,
    iat: maintenant,
    exp: maintenant + 300,
  });
  const signature = crypto.createHmac("sha256", secret).update(`${entete}.${corps}`).digest("base64url");
  return `${entete}.${corps}.${signature}`;
}

// Adresse de la page avec le jeton et le thème (« clair » ou « sombre », couleur d'accent, langue).
export function urlPageApp(app, { entrepriseId, entrepriseNom, apercu = false, theme, accent, lang }) {
  const u = new URL(app.url_page);
  u.searchParams.set("jeton", signerJeton({ secret: app.secret_page, appId: app.id, entrepriseId, entrepriseNom, apercu }));
  u.searchParams.set("theme", theme === "clair" ? "clair" : "sombre");
  if (/^#[0-9a-fA-F]{6}$/.test(accent || "")) u.searchParams.set("accent", accent);
  u.searchParams.set("lang", lang === "en" ? "en" : "fr");
  return u.toString();
}
