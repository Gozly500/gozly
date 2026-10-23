// Calcul des heures de la semaine pour le calculateur de paie (app employé). Pur : pas d'accès à la base,
// pour pouvoir le vérifier avec des cas précis. Les minutes sont multipliées par le taux côté affichage.

const TZ = "America/Toronto";

const dateDuQuebec = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);

function minutesDuQuebec(date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  return (Number(p.find((x) => x.type === "hour").value) % 24) * 60 + Number(p.find((x) => x.type === "minute").value);
}

const enMinutes = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
};

// quarts : [{ date: "AAAA-MM-JJ", heure_debut: "HH:MM[:SS]", heure_fin }] (horaire publié de la semaine)
// pointages : [{ entree, sortie }] (ISO ; sortie nulle = pointage encore ouvert, compté jusqu'à `maintenant`)
// Retourne { source, minutesGagnees, minutesPrevues, jours: { date: { gagnees, prevues } } }.
//  - prevues : heures de l'horaire ;
//  - gagnees : heures pointées s'il y a au moins un pointage cette semaine, sinon la part de l'horaire déjà écoulée
//    (pour les entreprises qui ne pointent pas).
export function calculerSemaine({ quarts = [], pointages = [], maintenant = new Date() }) {
  const aujourdhui = dateDuQuebec(maintenant);
  const minutesMaintenant = minutesDuQuebec(maintenant);
  const parJour = {};
  const jour = (d) => (parJour[d] = parJour[d] || { prevu: 0, pointe: 0, ecoule: 0 });

  for (const q of quarts) {
    const debut = enMinutes(q.heure_debut);
    const fin = enMinutes(q.heure_fin);
    const duree = Math.max(0, fin - debut);
    const j = jour(q.date);
    j.prevu += duree;
    if (q.date < aujourdhui) j.ecoule += duree;
    else if (q.date === aujourdhui) j.ecoule += Math.max(0, Math.min(fin, minutesMaintenant) - debut);
  }

  for (const p of pointages) {
    const entree = new Date(p.entree);
    const sortie = p.sortie ? new Date(p.sortie) : maintenant;
    jour(dateDuQuebec(entree)).pointe += Math.max(0, Math.round((sortie - entree) / 60000));
  }

  const aDesPointages = pointages.length > 0;
  const total = (cle) => Object.values(parJour).reduce((s, j) => s + j[cle], 0);
  return {
    source: aDesPointages ? "pointage" : "horaire",
    minutesGagnees: aDesPointages ? total("pointe") : total("ecoule"),
    minutesPrevues: total("prevu"),
    jours: Object.fromEntries(Object.entries(parJour).map(([d, j]) => [d, { gagnees: aDesPointages ? j.pointe : j.ecoule, prevues: j.prevu }])),
  };
}
