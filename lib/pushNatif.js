import crypto from "node:crypto";
import { apnsConfigure, envoyerApns } from "./pushApns";

// Envoi de notifications push NATIVES de l'app « Gozly Équipe » : Android directement à FCM (API HTTP v1),
// iPhone directement à Apple (voir pushApns.js), sans passer par Expo ni firebase-admin.
// Android : un jeton OAuth signé avec la clé du compte de service Firebase.
// Variable d'environnement : FIREBASE_SERVICE_ACCOUNT = le contenu JSON de la clé du compte de service.
// Table : employe_push_natifs (voir supabase/employe_push_natifs.sql).

let compte = undefined;
function lireCompte() {
  if (compte !== undefined) return compte;
  try {
    const brut = process.env.FIREBASE_SERVICE_ACCOUNT;
    compte = brut ? JSON.parse(brut) : null;
    if (compte?.private_key) compte.private_key = compte.private_key.replace(/\\n/g, "\n");
  } catch {
    compte = null;
  }
  return compte;
}

function fcmConfigure() {
  const c = lireCompte();
  return !!(c?.client_email && c?.private_key && c?.project_id);
}

export function pushNatifConfigure() {
  return fcmConfigure() || apnsConfigure();
}

const b64 = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");

let jetonCache = { valeur: null, expire: 0 };
async function jetonAcces() {
  if (jetonCache.valeur && Date.now() < jetonCache.expire - 60_000) return jetonCache.valeur;
  const c = lireCompte();
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = b64({ alg: "RS256", typ: "JWT" });
  const charge = b64({
    iss: c.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: maintenant,
    exp: maintenant + 3600,
  });
  const signature = crypto.sign("RSA-SHA256", Buffer.from(`${entete}.${charge}`), c.private_key).toString("base64url");
  const rep = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${entete}.${charge}.${signature}` }),
  });
  const data = await rep.json();
  if (!data.access_token) throw new Error("Jeton FCM refusé: " + (data.error_description || data.error || rep.status));
  jetonCache = { valeur: data.access_token, expire: Date.now() + (data.expires_in || 3600) * 1000 };
  return jetonCache.valeur;
}

// Envoie une notification à un appareil. Retourne { ok, expire } ; expire = jeton à supprimer (app désinstallée).
async function envoyerAJeton({ token, plateforme }, notif) {
  if (plateforme === "ios") return envoyerApns(token, notif);
  if (!fcmConfigure()) return { ok: false, code: "FCM_NON_CONFIGURE" };
  const { titre, corps, url } = notif;
  const c = lireCompte();
  const acces = await jetonAcces();
  const rep = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${acces}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: titre, body: corps },
        data: url ? { url } : undefined,
        android: { priority: "HIGH", notification: { channel_id: "default" } },
      },
    }),
  });
  if (rep.ok) return { ok: true };
  const erreur = await rep.json().catch(() => ({}));
  const code = erreur?.error?.details?.[0]?.errorCode || erreur?.error?.status || "";
  return { ok: false, statut: rep.status, code, expire: code === "UNREGISTERED" || rep.status === 404 };
}

// Envoie à tous les appareils natifs de ces employés (les filtres de préférences et d'heures calmes sont faits par l'appelant).
export async function envoyerPushNatifs(service, employeIds, notif) {
  if (!pushNatifConfigure() || employeIds.length === 0) return;
  const { data: jetons, error } = await service.from("employe_push_natifs").select("id, token, plateforme").in("employe_id", employeIds);
  if (error || !jetons?.length) return;
  await Promise.all(
    jetons.map(async (j) => {
      try {
        const r = await envoyerAJeton(j, notif);
        if (r.expire) await service.from("employe_push_natifs").delete().eq("id", j.id);
        else if (!r.ok) console.error("Erreur envoi push natif:", r.statut, r.code);
      } catch (e) {
        console.error("Erreur envoi push natif:", e?.message || e);
      }
    })
  );
}

// Test (Paramètres > Notifications) : { configure, nbAppareils, resultats }.
export async function envoyerTestNatif(service, employeId) {
  if (!pushNatifConfigure()) return { configure: false, nbAppareils: 0, resultats: [] };
  const { data: jetons } = await service.from("employe_push_natifs").select("id, token, plateforme").eq("employe_id", employeId);
  const liste = jetons || [];
  const resultats = [];
  for (const j of liste) {
    try {
      const r = await envoyerAJeton(j, { titre: "Gozly Équipe", corps: "Test : si tu vois ceci, les notifications du serveur fonctionnent.", url: "/parametres/notifications" });
      if (r.expire) await service.from("employe_push_natifs").delete().eq("id", j.id);
      resultats.push(r);
    } catch (e) {
      resultats.push({ ok: false, erreur: String(e?.message || e) });
    }
  }
  return { configure: true, nbAppareils: liste.length, resultats };
}
