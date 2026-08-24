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

// Certains sites Wix utilisent encore l'ancien catalogue (Catalog V1),
// d'autres le nouveau (V3) - les deux ne sont pas compatibles, et il n'y a
// pas de moyen de savoir lequel sans essayer (l'API dédiée pour vérifier
// demande une permission supplémentaire qu'on préfère éviter). V3 échoue
// avec un 428 "Failed Precondition" sur un site encore en V1 - dans ce cas
// précis on retombe sur l'API V1 plutôt que d'échouer.
async function obtenirInventaireWixV3(accessToken) {
  const res = await fetch("https://www.wixapis.com/stores/v3/inventory-items/query", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: accessToken },
    body: JSON.stringify({ query: {} }),
  });

  if (res.status === 428) return null; // Site encore en Catalog V1 - on retente avec V1 plus bas.
  if (!res.ok) {
    throw new Error(`Échec de la lecture de l'inventaire Wix (${res.status})`);
  }

  const data = await res.json();
  return data.inventoryItems || [];
}

// Catalog V1 : Query Products renvoie déjà le nom/SKU/stock ensemble (pas
// besoin d'un 2e appel comme pour V3) - un produit "à variantes" a son
// stock détaillé par variante, sinon le stock est directement sur le
// produit. On normalise vers la même forme que V3 pour que le reste du
// code n'ait pas à savoir laquelle des deux versions a répondu.
async function obtenirInventaireWixV1(accessToken) {
  const res = await fetch("https://www.wixapis.com/stores/v1/products/query", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: accessToken },
    body: JSON.stringify({ includeVariants: true }),
  });

  if (!res.ok) {
    throw new Error(`Échec de la lecture de l'inventaire Wix - catalogue V1 (${res.status})`);
  }

  const data = await res.json();
  const items = [];

  // Préfixe "v1:" pour distinguer sans ambiguïté un id venu du catalogue V1
  // (utilisé pour repousser une quantité vers le bon endpoint plus bas -
  // v1:<productId>:<variantId ou vide>) d'un id V3 (juste le GUID brut).
  for (const produit of data.products || []) {
    if (produit.manageVariants && produit.variants?.length > 0) {
      for (const variante of produit.variants) {
        const stock = variante.stock;
        const nomVariante = Object.values(variante.choices || {}).join(", ");
        items.push({
          id: `v1:${produit.id}:${variante.id}`,
          product: {
            name: nomVariante ? `${produit.name} — ${nomVariante}` : produit.name,
            variantSku: variante.variant?.sku || null,
          },
          quantity: stock?.trackQuantity ? stock.quantity : undefined,
          inStock: stock?.trackQuantity ? undefined : !!stock?.inStock,
        });
      }
    } else {
      const stock = produit.stock;
      items.push({
        id: `v1:${produit.id}:`,
        product: { name: produit.name, variantSku: produit.sku || null },
        quantity: stock?.trackInventory ? stock.quantity : undefined,
        inStock: stock?.trackInventory ? undefined : stock?.inventoryStatus !== "OUT_OF_STOCK",
      });
    }
  }

  return items;
}

// Récupère l'inventaire (jusqu'à 1000 items) pour l'instance Wix donnée,
// peu importe si le site est encore sur Catalog V1 ou déjà sur V3.
export async function obtenirInventaireWix(instanceId) {
  const accessToken = await obtenirJetonWix(instanceId);

  const itemsV3 = await obtenirInventaireWixV3(accessToken);
  if (itemsV3 !== null) return itemsV3;

  return obtenirInventaireWixV1(accessToken);
}

// Pousse une nouvelle quantité vers Wix pour un produit déjà lié
// (sourceId venant d'un sync précédent - voir obtenirInventaireWix). Gère
// V1 et V3 selon le préfixe de sourceId. Ne gère PAS la création d'un
// nouveau produit sur Wix (demande un prix, hors scope pour l'instant).
async function pousserQuantiteWixV3(accessToken, sourceId, quantite) {
  const resGet = await fetch(`https://www.wixapis.com/stores/v3/inventory-items/${sourceId}`, {
    headers: { Authorization: accessToken },
  });
  if (!resGet.ok) {
    throw new Error(`Échec de la lecture de l'item avant mise à jour (${resGet.status})`);
  }
  const { inventoryItem } = await resGet.json();

  const res = await fetch(`https://www.wixapis.com/stores/v3/inventory-items/${sourceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: accessToken },
    body: JSON.stringify({
      inventoryItem: { id: sourceId, revision: inventoryItem.revision, quantity: quantite },
      reason: "MANUAL",
    }),
  });
  if (!res.ok) {
    throw new Error(`Échec de l'envoi de la quantité vers Wix (${res.status})`);
  }
}

async function pousserQuantiteWixV1(accessToken, sourceId, quantite) {
  const [, productId, variantId] = sourceId.split(":");

  const inventoryItem = variantId
    ? { trackQuantity: true, variants: [{ variantId, quantity: quantite }] }
    : { trackQuantity: true, variants: [{ variantId: "00000000-0000-0000-0000-000000000000", quantity: quantite }] };

  const res = await fetch(`https://www.wixapis.com/stores/v2/inventoryItems/product/${productId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: accessToken },
    body: JSON.stringify({ inventoryItem }),
  });
  if (!res.ok) {
    throw new Error(`Échec de l'envoi de la quantité vers Wix - catalogue V1 (${res.status})`);
  }
}

export async function pousserQuantiteWix(instanceId, sourceId, quantite) {
  const accessToken = await obtenirJetonWix(instanceId);

  if (sourceId.startsWith("v1:")) {
    await pousserQuantiteWixV1(accessToken, sourceId, quantite);
  } else {
    await pousserQuantiteWixV3(accessToken, sourceId, quantite);
  }
}

// Vérifie la signature JWT d'un webhook Wix (voir /api/wix/webhook) avec la
// clé publique de l'app (Webhooks > ton webhook > Public key). Retourne
// l'événement décodé ({ eventType, instanceId, data: "...json..." }).
export function verifierWebhookWix(rawBody) {
  const publicKey = process.env.WIX_WEBHOOK_PUBLIC_KEY;
  if (!publicKey) throw new Error("WIX_WEBHOOK_PUBLIC_KEY manquante.");

  // Une clé PEM collée telle quelle dans une variable d'env sur une seule
  // ligne perd ses retours à la ligne réels - on accepte donc aussi la
  // version avec des "\n" échappés (pattern standard pour stocker des clés
  // PEM en env var) et on les reconvertit en vrais retours à la ligne.
  const cle = publicKey.includes("\\n") ? publicKey.replace(/\\n/g, "\n") : publicKey;

  const rawPayload = jwt.verify(rawBody, cle, { algorithms: ["RS256"] });
  return JSON.parse(rawPayload.data);
}
