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
// l'entreprise (Modules), « Terminée » = Fulfilled, « En attente » = Pending.
export const CHOIX_TRAITEE_WIX = ["Accepted", "Ready", "In_Delivery", "Fulfilled"];
export const CHOIX_TERMINEE_WIX = ["Ready", "In_Delivery", "Fulfilled"];

export function statutWixPourEtape(etape, reglageTraitee, reglageTerminee) {
  if (etape === "en_attente") return "Pending";
  if (etape === "terminee") return CHOIX_TERMINEE_WIX.includes(reglageTerminee) ? reglageTerminee : "Fulfilled";
  return CHOIX_TRAITEE_WIX.includes(reglageTraitee) ? reglageTraitee : "Accepted";
}

// Type d'une commande Wix : « restaurant » (Wix Restaurants : 5 statuts) ou « boutique » (Wix Boutique : préparée ou non).
// null = inconnu ou commande saisie à la main (elle suit les 3 étapes de Gozly).
export function typeCommande(c) {
  if (c?.type_wix === "restaurant" || c?.type_wix === "boutique") return c.type_wix;
  if (c?.statut_wix) return "restaurant";
  return null;
}

const ETAPES_GOZLY = [
  { id: "en_attente", etape: "en_attente", statut: null },
  { id: "traitee", etape: "traitee", statut: null },
  { id: "terminee", etape: "terminee", statut: null },
];

// Les étapes d'une commande en mode Liste. Restaurants : les 5 statuts Wix (En livraison seulement pour une livraison).
// Boutique et commandes manuelles : En attente, Traitée, Terminée.
export function etapesListe(c) {
  if (typeCommande(c) !== "restaurant") return ETAPES_GOZLY;
  return COLONNES_WIX.filter((x) => x.id !== "livraison" || c.mode === "livraison").map((x) => ({ id: x.id, etape: etapeDuStatutWix(x.statut), statut: x.statut }));
}

// L'étape où se trouve la commande (id d'une étape de etapesListe), selon son type.
export function stadeListe(c, etape) {
  return typeCommande(c) === "restaurant" ? colonneWix(c, etape) : etape;
}

// La prochaine étape d'une commande (null si terminée). `sauter` : de « En attente », « Accepter » saute directement
// à l'étape qui correspond au statut `cible` (réglage « Traitée = statut Wix »).
export function etapeSuivanteListe(c, etape, { sauter = false, cible = "Accepted" } = {}) {
  const liste = etapesListe(c);
  const stade = stadeListe(c, etape);
  const i = liste.findIndex((x) => x.id === stade);
  if (i < 0 || i >= liste.length - 1) return null;
  if (sauter && stade === "en_attente") {
    if (typeCommande(c) !== "restaurant") return liste[1];
    return liste.find((x) => x.statut === cible) || liste[1];
  }
  return liste[i + 1];
}
