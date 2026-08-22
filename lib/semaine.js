// Calcul du début de semaine, configurable par entreprise (lundi ou
// dimanche - voir entreprises.premier_jour_semaine et PersonnalisationSection).
export function getDebutSemaine(date, premierJourDimanche = false) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = premierJourDimanche ? -day : day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
