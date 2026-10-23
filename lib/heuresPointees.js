// Heures réellement travaillées par un employé (pointages : arrivée et départ), jour par jour, pour l'app employé.
// Pur : pas d'accès à la base, pour pouvoir le vérifier avec des cas précis.
//
// Les règles sont celles de la feuille de temps du gestionnaire (components/horaire/FeuilleTempsSection.jsx),
// pour que l'employé voie les mêmes heures que son gestionnaire :
//  - un pointage encore ouvert (sans départ) compte jusqu'à maintenant ;
//  - mode « horaire » (Entreprise > pointage_calcul_mode) : si l'employé pointe AVANT le début prévu de son quart ce
//    jour-là, le calcul part de l'heure prévue ; s'il pointe en retard, ou sans quart ce jour-là, l'heure réelle compte.

const TZ = "America/Toronto";

const dateDuQuebec = (date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);

const enMinutes = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
};

// Minuit (heure du Québec) d'une date "AAAA-MM-JJ", en millisecondes. L'écart avec l'UTC (-4 ou -5 selon l'heure d'été)
// est déduit de l'heure réelle plutôt que codé en dur.
function minuitQuebec(date) {
  const approx = new Date(`${date}T00:00:00Z`);
  const heure = parseInt(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(approx.getTime() + 12 * 3600 * 1000)),
    10
  );
  return approx.getTime() - ((heure % 24) - 12) * 3600 * 1000;
}

// pointages : [{ entree, sortie }] (ISO) ; quarts : [{ date: "AAAA-MM-JJ", heure_debut }] (seulement utile en mode « horaire »).
// Retourne { minutesTotal, jours: { "AAAA-MM-JJ": { minutes, enCours, plages: [{ entree, sortie }] } } }.
// Un pointage est compté dans le jour (heure du Québec) où il commence.
export function heuresPointees({ pointages = [], quarts = [], modeCalcul = "reel", maintenant = new Date() }) {
  const jours = {};

  for (const p of pointages) {
    const entree = new Date(p.entree);
    const sortie = p.sortie ? new Date(p.sortie) : maintenant;
    const date = dateDuQuebec(entree);

    let debut = entree;
    if (modeCalcul === "horaire") {
      const quart = quarts.find((q) => q.date === date);
      if (quart) {
        const prevu = new Date(minuitQuebec(date) + enMinutes(quart.heure_debut) * 60000);
        if (entree < prevu) debut = prevu;
      }
    }

    const minutes = Math.max(0, Math.round((sortie - debut) / 60000));
    const j = (jours[date] = jours[date] || { minutes: 0, enCours: false, plages: [] });
    j.minutes += minutes;
    if (!p.sortie) j.enCours = true;
    j.plages.push({ entree: p.entree, sortie: p.sortie || null });
  }

  for (const j of Object.values(jours)) j.plages.sort((a, b) => new Date(a.entree) - new Date(b.entree));
  return { minutesTotal: Object.values(jours).reduce((s, j) => s + j.minutes, 0), jours };
}
