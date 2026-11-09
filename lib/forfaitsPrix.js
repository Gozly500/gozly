// Prix des forfaits en $ CAD (avant taxes) : mensuel, ou annuel = 12 mois sans rabais (les rabais passent par des codes promo Stripe).
// Les montants facturés sont ceux de Stripe : chaque prix y porte une clé de recherche (lookup key) = « opale », « onyx »,
// « crystal » (mensuel) ou « opale_annuel », « onyx_annuel », « crystal_annuel » (annuel). Garder ces chiffres synchro avec Stripe.
export const PRIX_FORFAITS = {
  opale: { mensuel: 35, annuel: 420 },
  onyx: { mensuel: 59, annuel: 708 },
  crystal: { mensuel: 85, annuel: 1020 },
};

export const PERIODES = ["mensuel", "annuel"];

// Clé de recherche Stripe d'un forfait pour une période.
export function cleStripe(forfait, periode) {
  return periode === "annuel" ? `${forfait}_annuel` : forfait;
}

// Forfait (« opale »...) d'une clé de recherche Stripe, mensuelle ou annuelle ; chaîne vide si ce n'est pas un de nos forfaits.
export function forfaitDepuisCle(cle) {
  const base = String(cle || "").replace(/_annuel$/, "");
  return Object.prototype.hasOwnProperty.call(PRIX_FORFAITS, base) ? base : "";
}
