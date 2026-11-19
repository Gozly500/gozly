// Fausses ventes Wix de la démo : une journée de transactions générée de façon stable à partir de la date
// (la même date donne toujours les mêmes ventes), pour essayer l'import, la page d'une journée et la conciliation.

function graine(texte) {
  let h = 2166136261;
  for (const c of texte) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const arrondi = (n) => Math.round(n * 100) / 100;

export function journeeFictive(date) {
  const alea = graine("demo-ventes-" + date);
  const jour = new Date(`${date}T12:00:00`).getDay();
  const fin = jour === 0 || jour === 6;
  const nbComptoir = Math.round((fin ? 44 : 30) + alea() * 10);
  const nbEnLigne = Math.round((fin ? 9 : 5) + alea() * 4);
  const transactions = [];
  const resume = { nb_en_ligne: 0, nb_comptoir: 0, total_en_ligne: 0, total_comptoir: 0, taxes: 0, pourboires: 0, remboursements: 0, par_paiement: {} };

  const ajouter = (canal, i) => {
    const net = arrondi(6 + alea() * (canal === "comptoir" ? 34 : 52));
    const methode = canal === "en_ligne" || alea() < 0.72 ? "Carte de debit/credit" : "Comptant";
    const heure = new Date(`${date}T${String(7 + Math.floor(alea() * 12)).padStart(2, "0")}:${String(Math.floor(alea() * 60)).padStart(2, "0")}:00-05:00`).toISOString();
    const taxes = arrondi((net * 0.14975) / 1.14975);
    transactions.push({ id: `${date}-${canal}-${i}`, numero: String(10000 + Math.floor(alea() * 9000)), canal, heure, total: net, brut: net, taxes, pourboire: 0, rembourse: 0, methode, statut: "Payée", comptee: true });
    resume[canal === "comptoir" ? "nb_comptoir" : "nb_en_ligne"] += 1;
    resume[canal === "comptoir" ? "total_comptoir" : "total_en_ligne"] += net;
    resume.taxes += taxes;
    resume.par_paiement[methode] = arrondi((resume.par_paiement[methode] || 0) + net);
  };
  for (let i = 0; i < nbComptoir; i++) ajouter("comptoir", i);
  for (let i = 0; i < nbEnLigne; i++) ajouter("en_ligne", i);

  for (const k of ["total_en_ligne", "total_comptoir", "taxes"]) resume[k] = arrondi(resume[k]);
  transactions.sort((a, b) => b.heure.localeCompare(a.heure));
  return { transactions, resume };
}
