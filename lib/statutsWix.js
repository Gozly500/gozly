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

// Modèle Gozly (liste ou 3 sections) : le statut Wix qui correspond à une étape. « Traitée » prend le réglage de
// l'entreprise (Personnalisation), « Terminée » = Fulfilled, « En attente » = Pending.
export const CHOIX_TRAITEE_WIX = ["Accepted", "Ready", "Fulfilled"];

export function statutWixPourEtape(etape, reglageTraitee) {
  if (etape === "en_attente") return "Pending";
  if (etape === "terminee") return "Fulfilled";
  return CHOIX_TRAITEE_WIX.includes(reglageTraitee) ? reglageTraitee : "Accepted";
}
