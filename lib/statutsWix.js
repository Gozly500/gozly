// Modèle « Wix » du kiosque des commandes : les sections reprennent les statuts de préparation de Wix Restaurants
// (fulfillments[].status : Pending, Accepted, Ready, In_Delivery, Fulfilled). Partagé serveur / client, sans import de Node.
// `etape` (en_attente / traitee / terminee) reste la vérité pour le reste de Gozly : le statut Wix y est rattaché par etapeDuStatutWix.

export const STATUTS_WIX_ORDRE = ["Pending", "Accepted", "Ready", "In_Delivery", "Fulfilled"];

// Sections du kiosque en modèle Wix. `statut` = le statut Wix que reçoit la commande en arrivant dans la section.
export const COLONNES_WIX = [
  { id: "en_attente", statut: "Pending", couleur: "#ffd479" },
  { id: "acceptee", statut: "Accepted", couleur: "#8ab4ff" },
  { id: "prete", statut: "Ready", couleur: "#b79cff" },
  { id: "livraison", statut: "In_Delivery", couleur: "#ffb26b" },
  { id: "terminee", statut: "Fulfilled", couleur: "#7ee2a8" },
];

export function etapeDuStatutWix(statut) {
  if (statut === "Pending") return "en_attente";
  if (statut === "Fulfilled") return "terminee";
  return "traitee"; // Accepted, Ready, In_Delivery
}

// Section d'une commande en modèle Wix : son statut Wix s'il est connu, sinon déduite de l'étape Gozly
// (commande Boutique ou manuelle, sans statut de préparation Wix).
export function colonneWix(commande, etape) {
  const trouve = COLONNES_WIX.find((c) => c.statut === commande.statut_wix);
  if (trouve) return trouve.id;
  if (etape === "terminee") return "terminee";
  if (etape === "traitee") return "acceptee";
  return "en_attente";
}

// Statut suivant / précédent d'une commande dans la liste des sections. La livraison n'existe que pour les commandes en livraison.
export function statutSuivantWix(commande, colonneId) {
  const i = COLONNES_WIX.findIndex((c) => c.id === colonneId);
  if (i < 0 || i >= COLONNES_WIX.length - 1) return null;
  let suivant = COLONNES_WIX[i + 1];
  if (suivant.id === "livraison" && commande.mode !== "livraison") suivant = COLONNES_WIX[i + 2];
  return suivant?.statut || null;
}

export function statutPrecedentWix(commande, colonneId) {
  const i = COLONNES_WIX.findIndex((c) => c.id === colonneId);
  if (i <= 0) return null;
  let precedent = COLONNES_WIX[i - 1];
  if (precedent.id === "livraison" && commande.mode !== "livraison") precedent = COLONNES_WIX[i - 2];
  return precedent?.statut || null;
}

// Affichages Gozly (liste ou 3 sections) : le statut Wix qui correspond à une étape.
//  - par défaut : « Accepter » -> Accepted, puis « Terminer » -> Fulfilled (traitée chez Wix) ;
//  - réglage « Traiter automatiquement à l'acceptation » : « Traitée » -> Fulfilled tout de suite.
export function statutWixPourEtape(etape, traiterAuto = false) {
  if (etape === "en_attente") return "Pending";
  if (etape === "terminee" || traiterAuto) return "Fulfilled";
  return "Accepted";
}

// Identifiant de l'app Wix Stores (Wix Boutique) dans les articles d'une commande.
const APP_WIX_STORES = "215238eb-22a5-4c36-9e7b-e7c08025e04e";

export function articlesBoutique(brut) {
  const articles = brut?.lineItems || [];
  return articles.length > 0 && articles.every((a) => a?.catalogReference?.appId === APP_WIX_STORES);
}

// Type d'une commande Wix : « restaurant » (Wix Restaurants) ou « boutique » (Wix Boutique : préparée ou non).
// Tant que le type n'est pas détecté, on le déduit des articles. null = commande saisie à la main.
export function typeCommande(c) {
  if (c?.type_wix === "restaurant" || c?.type_wix === "boutique") return c.type_wix;
  if (c?.statut_wix) return "restaurant";
  if (c?.source === "wix") return articlesBoutique(c.brut) ? "boutique" : "restaurant";
  return null;
}

// La commande affiche-t-elle « Accepter / Acceptée » (Wix Restaurants, réglage automatique désactivé) plutôt que « Traitée » ?
export function motAcceptee(c, traiterAuto = false) {
  return !traiterAuto && typeCommande(c) === "restaurant";
}
