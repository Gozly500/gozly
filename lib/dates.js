// La date du jour côté serveur (Vercel tourne en UTC) doit être calculée
// dans le fuseau horaire de l'entreprise (Québec, Est) plutôt qu'en UTC -
// sinon "aujourd'hui" bascule au jour suivant dès 20h/21h heure locale
// (ex: 00h30 UTC = 20h30 la veille en heure de l'Est), ce qui désaligne
// tout ce qui compare une date stockée (ex: planning_quarts.date, entré
// dans le fuseau local de la personne qui gère l'horaire) à "aujourd'hui".
export function aujourdhuiLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
}

// ---- Affichage et saisie des heures de pointage : toujours en heure du Québec ----
// Sans ça, un gestionnaire qui regarde la feuille de temps depuis un autre fuseau (voyage) voit les heures décalées.
const TZ_ENTREPRISE = "America/Toronto";

// "09:00" à partir d'un instant ISO, dans le fuseau de l'entreprise.
export function heureEntreprise(iso, locale = "fr-CA", options = { hour: "2-digit", minute: "2-digit" }) {
  return new Date(iso).toLocaleTimeString(locale, { ...options, timeZone: TZ_ENTREPRISE });
}

// Parties (année, mois, jour, heure, minute) d'un instant, vues depuis le Québec.
function partiesEntreprise(date) {
  const p = {};
  for (const x of new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_ENTREPRISE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date)) p[x.type] = x.value;
  return p;
}

// Instant ISO -> "AAAA-MM-JJTHH:MM" pour <input type="datetime-local">, en heure du Québec.
export function versDatetimeLocal(iso) {
  if (!iso) return "";
  const p = partiesEntreprise(new Date(iso));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// "AAAA-MM-JJTHH:MM" (heure du Québec) -> instant ISO.
export function depuisDatetimeLocal(valeur) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valeur || "");
  if (!m) return new Date(valeur).toISOString();
  const [, a, mo, j, h, mi] = m.map(Number);
  const voulu = Date.UTC(a, mo - 1, j, h, mi);
  let t = voulu;
  for (let i = 0; i < 2; i++) {
    const p = partiesEntreprise(new Date(t));
    const vu = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    t += voulu - vu;
  }
  return new Date(t).toISOString();
}
