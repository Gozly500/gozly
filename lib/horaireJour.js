// Calculs de la vue « journée » de l'horaire (quarts affichés en blocs sur une ligne du temps).

const minutes = (h) => {
  const [hh, mm] = String(h).split(":").map(Number);
  return (hh || 0) * 60 + (mm || 0);
};

export function heureTexte(m) {
  const v = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

// Début et fin d'un quart en minutes depuis minuit ; une fin avant le début veut dire « après minuit ».
export function bloc(quart) {
  const de = minutes(quart.heure_debut);
  let a = minutes(quart.heure_fin);
  if (a <= de) a += 1440;
  return { de, a };
}

// Heures affichées : de 7 h à 21 h, élargies pour contenir tous les quarts de la journée.
export function plageHeures(quarts) {
  let debut = 7;
  let fin = 21;
  for (const q of quarts) {
    const { de, a } = bloc(q);
    debut = Math.min(debut, Math.floor(de / 60));
    fin = Math.max(fin, Math.ceil(a / 60));
  }
  return { debut, fin };
}
