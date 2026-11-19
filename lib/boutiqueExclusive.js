// Une seule boutique en ligne à la fois par dashboard (Wix OU Shopify) : évite des produits en double, des commandes
// mélangées et deux synchros d'inventaire qui s'écrasent. Quand Shopify sera branché, il suffit que sa table de
// connexion ait le nom ci-dessous (la vérification ignore une table qui n'existe pas encore).

export const BOUTIQUES = {
  wix: { nom: "Wix", table: "wix_connexions" },
  shopify: { nom: "Shopify", table: "shopify_connexions" },
};

// Nom de l'AUTRE boutique déjà connectée à ce dashboard (null s'il n'y en a pas). `plateforme` = celle qu'on veut connecter.
export async function autreBoutiqueConnectee(service, entrepriseId, plateforme) {
  for (const [id, b] of Object.entries(BOUTIQUES)) {
    if (id === plateforme) continue;
    try {
      const { data, error } = await service.from(b.table).select("statut").eq("entreprise_id", entrepriseId).maybeSingle();
      if (!error && data?.statut === "connecte") return b.nom;
    } catch {}
  }
  return null;
}

export function messageBoutique(autre, voulue) {
  return `${autre} est déjà connecté à ce dashboard. Une seule boutique en ligne à la fois : déconnecte ${autre} avant de connecter ${voulue}.`;
}
