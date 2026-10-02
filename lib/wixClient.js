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
          // Prix de la variante (sinon celui du produit) - sert aux commandes manuelles.
          prix: variante.variant?.priceData?.price ?? produit.price?.price,
        });
      }
    } else {
      const stock = produit.stock;
      items.push({
        id: `v1:${produit.id}:`,
        product: { name: produit.name, variantSku: produit.sku || null },
        quantity: stock?.trackInventory ? stock.quantity : undefined,
        inStock: stock?.trackInventory ? undefined : stock?.inventoryStatus !== "OUT_OF_STOCK",
        prix: produit.price?.price,
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

function montantWix(champ) {
  const n = parseFloat(champ?.amount);
  return Number.isFinite(n) ? n : null;
}

// Date Wix -> ISO, ou null. Accepte une chaîne ISO ou un horodatage
// { seconds } (selon l'endroit où Wix la renvoie).
function versIso(valeur) {
  if (!valeur) return null;
  if (typeof valeur === "string") {
    const ms = Date.parse(valeur);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  if (valeur.seconds != null) {
    const ms = Number(valeur.seconds) * 1000;
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  return null;
}

// Met une commande de l'API eCommerce Orders de Wix (qui couvre Wix Stores
// ET Wix Restaurants) à la forme de la table commandes_en_ligne. Défensif :
// les champs optionnels (options des plats, ramassage vs livraison) varient
// selon l'app qui a créé la commande.
function normaliserCommandeWix(commande) {
  const contact = commande.billingInfo?.contactDetails || commande.recipientInfo?.contactDetails || {};
  const nomClient = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || null;

  const logistique = commande.shippingInfo?.logistics;
  let mode = null;
  if (logistique?.pickupDetails) mode = "ramassage";
  else if (logistique?.shippingDestination) mode = "livraison";

  const texteTraduit = (t) => (typeof t === "string" ? t : t?.translated || t?.original || "");

  const items = (commande.lineItems || []).map((li) => {
    const options = (li.descriptionLines || [])
      .map((d) => {
        const valeur = d.plainText?.translated || d.plainText?.original || d.colorInfo?.original || "";
        const nom = d.name?.translated || d.name?.original || "";
        return nom && valeur ? `${nom}: ${valeur}` : valeur || nom;
      })
      .filter(Boolean);

    // Wix Restaurants : les choix du client (taille, ingrédients...) sont des
    // "modifiers" regroupés par groupe, pas des descriptionLines.
    for (const groupe of li.modifierGroups || []) {
      const nomGroupe = texteTraduit(groupe.name);
      for (const m of groupe.modifiers || []) {
        const label = texteTraduit(m.label) || texteTraduit(m.name) || texteTraduit(m.details);
        if (!label) continue;
        const quantiteMod = m.quantity > 1 ? ` x${m.quantity}` : "";
        options.push(nomGroupe ? `${nomGroupe}: ${label}${quantiteMod}` : `${label}${quantiteMod}`);
      }
    }

    return {
      nom: li.productName?.translated || li.productName?.original || "Article",
      quantite: li.quantity || 1,
      prix: montantWix(li.price),
      // Pour relier l'article au produit de l'inventaire et regrouper par produit.
      produit_id: li.catalogReference?.catalogItemId || null,
      sku: li.physicalProperties?.sku || null,
      options,
    };
  });

  // Date/heure de ramassage : le créneau choisi par le client (début + fin).
  const creneau = logistique?.deliveryTimeSlot;
  const dateRamassage = versIso(creneau?.from) || versIso(logistique?.deliverByDate);
  const dateRamassageFin = versIso(creneau?.to);

  return {
    source: "wix",
    source_id: commande.id,
    numero: commande.number != null ? String(commande.number) : null,
    statut: commande.status || null,
    statut_paiement: commande.paymentStatus || null,
    statut_preparation: commande.fulfillmentStatus || null,
    mode,
    client_nom: nomClient,
    client_courriel: commande.buyerInfo?.email || null,
    sous_total: montantWix(commande.priceSummary?.subtotal),
    taxes: montantWix(commande.priceSummary?.tax),
    total: montantWix(commande.priceSummary?.total) ?? 0,
    items,
    date_commande: commande.createdDate,
    date_ramassage: dateRamassage,
    date_ramassage_fin: dateRamassageFin,
    // Canal de vente : WEB, POS (point de vente), BACKOFFICE_MERCHANT...
    canal: commande.channelInfo?.type || "WEB",
    lieu_id: commande.businessLocation?.id || null,
    lieu_nom: commande.businessLocation?.name || null,
    brut: commande,
  };
}

// Diagnostic d'un 403 sur les commandes : teste quelques appels Wix avec le
// même jeton pour voir ce que cette installation a RÉELLEMENT le droit de
// faire (les permissions cochées dans l'app ne comptent que si le site les a
// reçues à l'installation / la mise à jour).
export async function diagnostiquerPermissionsWix(instanceId) {
  const accessToken = await obtenirJetonWix(instanceId);
  const headers = { "Content-Type": "application/json", Authorization: accessToken };
  const tests = [
    ["ecom-orders", "https://www.wixapis.com/ecom/v1/orders/search", { search: { cursorPaging: { limit: 1 } } }],
    ["stores-orders-v2", "https://www.wixapis.com/stores/v2/orders/query", { query: { paging: { limit: 1 } } }],
    ["stores-products-v1", "https://www.wixapis.com/stores/v1/products/query", { query: { paging: { limit: 1 } } }],
    ["app-instance", "https://www.wixapis.com/apps/v1/instance", null],
  ];

  const resultats = [];
  for (const [nom, url, body] of tests) {
    try {
      const res = await fetch(url, body ? { method: "POST", headers, body: JSON.stringify(body) } : { headers });
      resultats.push(`${nom}=${res.status}`);
    } catch {
      resultats.push(`${nom}=erreur`);
    }
  }
  return resultats.join(", ");
}

// Lit les commandes Wix créées depuis `depuisIso` (jusqu'à 500, les plus
// récentes d'abord). Les commandes PENDING/REJECTED ne sont pas renvoyées
// par défaut par Wix, d'où le filtre explicite sur status.
//
// `canal` : "en_ligne" (tout sauf le point de vente) ou "pos" (point de
// vente seulement). On les lit en deux appels séparés : sinon des centaines
// de ventes au comptoir remplissent la limite de 500 et cachent les commandes
// en ligne.
export async function obtenirCommandesWix(instanceId, depuisIso, canal = "en_ligne", maxPages = 5) {
  const accessToken = await obtenirJetonWix(instanceId);
  const veutPos = canal === "pos";
  const estPos = (c) => c.canal === "POS";

  async function lire(filtreCanal) {
    const commandes = [];
    let cursor;

    for (let page = 0; page < maxPages; page++) {
      const res = await fetch("https://www.wixapis.com/ecom/v1/orders/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: accessToken },
        body: JSON.stringify({
          search: {
            filter: {
              createdDate: { $gte: depuisIso },
              status: { $in: ["APPROVED", "PENDING", "CANCELED"] },
              ...(filtreCanal || {}),
            },
            sort: [{ fieldName: "createdDate", order: "DESC" }],
            cursorPaging: cursor ? { limit: 100, cursor } : { limit: 100 },
          },
        }),
      });

      if (!res.ok) {
        // Garde le message de Wix (permission manquante, app non installée...)
        // pour que l'erreur affichée dise vraiment pourquoi.
        const corps = await res.text().catch(() => "");
        const erreur = new Error(`Échec de la lecture des commandes Wix (${res.status}) ${corps.slice(0, 400)}`);
        erreur.status = res.status;
        throw erreur;
      }

      const data = await res.json();
      for (const c of data.orders || []) commandes.push(normaliserCommandeWix(c));

      cursor = data.metadata?.cursors?.next;
      if (!data.metadata?.hasNext || !cursor) break;
    }

    return commandes;
  }

  const filtreCanal = { "channelInfo.type": veutPos ? { $eq: "POS" } : { $ne: "POS" } };
  try {
    return await lire(filtreCanal);
  } catch (err) {
    // 400 = Wix n'accepte pas ce filtre : on relit sans filtre de canal et on
    // trie nous-mêmes (moins efficace, mais jamais bloquant).
    if (err.status !== 400) throw err;
    const toutes = await lire(null);
    return toutes.filter((c) => (veutPos ? estPos(c) : !estPos(c)));
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
