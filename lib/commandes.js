// Aides partagées par la page Commandes en ligne, son kiosque et son widget.

// Catégorie des tâches créées automatiquement par le module Commandes en ligne
// (voir lib/tachesCommandes.js) : l'interface la marque "Géré par un module".
export const NOM_CATEGORIE_COMMANDES = "Réservations";
// Ancien nom de cette catégorie : renommée automatiquement en "Réservations".
export const ANCIEN_NOM_CATEGORIE_COMMANDES = "Commandes à ramasser";

export function formatMontant(n, locale = "fr-CA") {
  return Number(n || 0).toLocaleString(locale, { style: "currency", currency: "CAD" });
}

// Date du jour (YYYY-MM-DD) dans le fuseau du Québec, comme lib/dates.js
// côté serveur - sinon "aujourd'hui" bascule trop tôt le soir.
export function dateAujourdhui() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}

export function decalerJour(date, delta) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Début (inclus) et fin (exclue) d'une journée locale du Québec en ISO UTC,
// pour filtrer date_commande (timestamptz). L'offset (-4/-5 selon l'heure
// d'été) est déduit de l'heure réelle plutôt que codé en dur.
export function bornesJour(date) {
  function minuitQuebec(d) {
    const approx = new Date(`${d}T00:00:00Z`);
    const heureQuebec = parseInt(
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", hour12: false }).format(
        new Date(approx.getTime() + 12 * 3600 * 1000)
      ),
      10
    );
    // À midi UTC, il est heureQuebec h à Québec : offset = heureQuebec - 12 (négatif).
    const offsetHeures = (heureQuebec % 24) - 12;
    return new Date(approx.getTime() - offsetHeures * 3600 * 1000).toISOString();
  }
  return { debut: minuitQuebec(date), fin: minuitQuebec(decalerJour(date, 1)) };
}

export function heureCommande(iso, locale = "fr-CA") {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" });
}

// Date qui compte pour une commande : le ramassage s'il y en a un (précommande),
// sinon le moment où elle a été passée.
export function dateEffective(c) {
  return c.date_ramassage || c.date_commande;
}

// Ajoute à une requête Supabase le filtre "date effective dans [debut, fin[" :
// ramassage dans l'intervalle, ou - sans ramassage - date de commande dans l'intervalle.
export function filtrerParDateEffective(requete, debut, fin) {
  return requete.or(
    `and(date_ramassage.gte.${debut},date_ramassage.lt.${fin}),and(date_ramassage.is.null,date_commande.gte.${debut},date_commande.lt.${fin})`
  );
}

// "10 h 00 - 11 h 00" (ou juste "10 h 00") quand la commande a un ramassage prévu, sinon null.
export function libelleRamassage(c, locale = "fr-CA") {
  if (!c.date_ramassage) return null;
  const debut = heureCommande(c.date_ramassage, locale);
  return c.date_ramassage_fin ? `${debut} - ${heureCommande(c.date_ramassage_fin, locale)}` : debut;
}

export function libelleMode(mode) {
  if (mode === "ramassage") return "Ramassage";
  if (mode === "livraison") return "Livraison";
  return null;
}

// Étape d'une commande : "annulee", "en_attente", "traitee" ou "terminee".
// `etape` (posée par le kiosque / les boutons) a priorité ; sinon on la
// déduit du statut Wix (une commande que Wix dit déjà préparée = terminée).
export function etapeCommande(c) {
  if (c.statut === "CANCELED") return "annulee";
  if (c.etape) return c.etape;
  return c.statut_preparation === "FULFILLED" ? "terminee" : "en_attente";
}

const ETATS = {
  annulee: { texte: "Annulée", couleur: "#ff9494" },
  en_attente: { texte: "En attente", couleur: "#ffd479" },
  traitee: { texte: "Traitée", couleur: "#8ab4ff" },
  terminee: { texte: "Terminée", couleur: "#7ee2a8" },
};

// Libellé + couleur de pastille de l'étape d'une commande.
export function etatCommande(c) {
  return { id: etapeCommande(c), ...ETATS[etapeCommande(c)] };
}

export function libellePaiement(c) {
  if (c.statut_paiement === "PAID") return "Payée";
  if (c.statut_paiement === "PARTIALLY_PAID") return "Partiellement payée";
  if (c.statut_paiement === "REFUNDED" || c.statut_paiement === "PARTIALLY_REFUNDED") return "Remboursée";
  if (c.statut_paiement === "NOT_PAID") return "Non payée";
  return null;
}

// Info supplémentaire d'une commande : celle saisie à la main, sinon la note du client chez Wix.
export function noteCommande(c) {
  return c.note || c.brut?.buyerNote || null;
}
