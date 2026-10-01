// Aides partagées par la page Commandes en ligne et son widget.

export function formatMontant(n) {
  return Number(n || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
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

export function heureCommande(iso) {
  return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" });
}

export function libelleMode(mode) {
  if (mode === "ramassage") return "Ramassage";
  if (mode === "livraison") return "Livraison";
  return null;
}

// Résume l'état d'une commande Wix en un libellé + une couleur de pastille.
export function etatCommande(c) {
  if (c.statut === "CANCELED") return { texte: "Annulée", couleur: "#ff9494" };
  if (c.statut === "PENDING") return { texte: "En attente", couleur: "#ffd479" };
  if (c.statut_preparation === "FULFILLED") return { texte: "Terminée", couleur: "#7ee2a8" };
  return { texte: "À préparer", couleur: "#8ab4ff" };
}

export function libellePaiement(c) {
  if (c.statut_paiement === "PAID") return "Payée";
  if (c.statut_paiement === "PARTIALLY_PAID") return "Partiellement payée";
  if (c.statut_paiement === "REFUNDED" || c.statut_paiement === "PARTIALLY_REFUNDED") return "Remboursée";
  if (c.statut_paiement === "NOT_PAID") return "Non payée";
  return null;
}
