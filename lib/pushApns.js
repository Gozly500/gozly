import crypto from "node:crypto";
import http2 from "node:http2";

// Envoi de notifications push à l'app iPhone « Gozly Équipe », directement à Apple (APNs, HTTP/2), sans service intermédiaire.
// Variables d'environnement : APNS_KEY (contenu du fichier .p8), APNS_KEY_ID, APNS_TEAM_ID.

const SUJET = "net.gozly.employe"; // identifiant de l'app iPhone
const HOTE = "https://api.push.apple.com"; // production (les versions TestFlight et App Store)

function lireCle() {
  const cle = process.env.APNS_KEY?.replace(/\\n/g, "\n");
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  return cle && keyId && teamId ? { cle, keyId, teamId } : null;
}

export const apnsConfigure = () => !!lireCle();

const b64 = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");

// Apple refuse un jeton de plus d'une heure, et aussi qu'on en refasse un trop souvent : on le garde 50 minutes.
let jetonCache = { valeur: null, cree: 0 };
function jetonApns({ cle, keyId, teamId }) {
  if (jetonCache.valeur && Date.now() - jetonCache.cree < 50 * 60_000) return jetonCache.valeur;
  const debut = `${b64({ alg: "ES256", kid: keyId })}.${b64({ iss: teamId, iat: Math.floor(Date.now() / 1000) })}`;
  const signature = crypto.sign("sha256", Buffer.from(debut), { key: cle, dsaEncoding: "ieee-p1363" }).toString("base64url");
  jetonCache = { valeur: `${debut}.${signature}`, cree: Date.now() };
  return jetonCache.valeur;
}

// Envoie une notification à un iPhone. Retourne { ok, statut, code, expire } ; expire = jeton à supprimer (app désinstallée).
export async function envoyerApns(token, { titre, corps, url }) {
  const config = lireCle();
  if (!config) return { ok: false, code: "APNS_NON_CONFIGURE" };
  const autorisation = `bearer ${jetonApns(config)}`;
  // expo-notifications (iPhone) lit les données d'une notification distante dans la clé « body ».
  const contenu = JSON.stringify({ aps: { alert: { title: titre, body: corps }, sound: "default" }, body: url ? { url } : {} });

  return new Promise((resoudre, rejeter) => {
    const session = http2.connect(HOTE);
    const echec = (e) => {
      session.destroy();
      rejeter(e);
    };
    session.on("error", echec);
    const requete = session.request({
      ":method": "POST",
      ":path": `/3/device/${encodeURIComponent(token)}`,
      authorization: autorisation,
      "apns-topic": SUJET,
      "apns-push-type": "alert",
      "apns-priority": "10",
    });
    requete.setTimeout(10_000, () => echec(new Error("APNs : délai dépassé")));
    requete.on("error", echec);
    let statut = 0;
    let reponse = "";
    requete.setEncoding("utf8");
    requete.on("response", (entetes) => (statut = entetes[":status"]));
    requete.on("data", (morceau) => (reponse += morceau));
    requete.on("end", () => {
      session.close();
      if (statut === 200) return resoudre({ ok: true });
      let code = "";
      try {
        code = JSON.parse(reponse).reason || "";
      } catch {}
      resoudre({ ok: false, statut, code, expire: statut === 410 });
    });
    requete.end(contenu);
  });
}
