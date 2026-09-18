// La date du jour côté serveur (Vercel tourne en UTC) doit être calculée
// dans le fuseau horaire de l'entreprise (Québec, Est) plutôt qu'en UTC -
// sinon "aujourd'hui" bascule au jour suivant dès 20h/21h heure locale
// (ex: 00h30 UTC = 20h30 la veille en heure de l'Est), ce qui désaligne
// tout ce qui compare une date stockée (ex: planning_quarts.date, entré
// dans le fuseau local de la personne qui gère l'horaire) à "aujourd'hui".
export function aujourdhuiLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}
