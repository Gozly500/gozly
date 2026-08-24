import jwt from "jsonwebtoken";

// Lien d'installation généré dans le tableau de bord de l'app Gozly sur
// dev.wix.com (Distribute App > Share Install Link). Pas un secret - c'est
// ce lien que le client clique pour connecter son compte Wix.
export const WIX_INSTALL_LINK = "https://wix.to/bZzFYIw";

// Échange App ID + App Secret + instanceId contre un jeton d'accès Wix
// (protocole OAuth Client Credentials - valide 4h, à régénérer à chaque
// appel plutôt que de le mettre en cache, pour rester simple).
export async function obtenirJetonWix(instanceId) {
  const res = await fetch("https://www.wixapis.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.WIX_APP_ID,
      client_secret: process.env.WIX_APP_SECRET,
      instance_id: instanceId,
    }),
  });

  if (!res.ok) {
    throw new Error(`Échec de l'obtention du jeton Wix (${res.status})`);
  }

  const data = await res.json();
  return data.access_token;
}

// Récupère l'inventaire (jusqu'à 1000 items) pour l'instance Wix donnée.
export async function obtenirInventaireWix(instanceId) {
  const accessToken = await obtenirJetonWix(instanceId);

  const res = await fetch("https://www.wixapis.com/stores/v3/inventory-items/query", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: accessToken },
    body: JSON.stringify({ query: {} }),
  });

  if (!res.ok) {
    throw new Error(`Échec de la lecture de l'inventaire Wix (${res.status})`);
  }

  const data = await res.json();
  return data.inventoryItems || [];
}

// Vérifie la signature JWT d'un webhook Wix (voir /api/wix/webhook) avec la
// clé publique de l'app (Webhooks > ton webhook > Public key). Retourne
// l'événement décodé ({ eventType, instanceId, data: "...json..." }).
export function verifierWebhookWix(rawBody) {
  const publicKey = process.env.WIX_WEBHOOK_PUBLIC_KEY;
  if (!publicKey) throw new Error("WIX_WEBHOOK_PUBLIC_KEY manquante.");

  const rawPayload = jwt.verify(rawBody, publicKey, { algorithms: ["RS256"] });
  return JSON.parse(rawPayload.data);
}
