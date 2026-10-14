// Heures calmes d'un employé (voir supabase/notifications_sourdine.sql) : pas de notification pendant la plage
// qu'il a choisie, heure du Québec, qui peut passer minuit (ex. 22:00 -> 07:00).

function minutesQuebec(d) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get("hour") * 60 + get("minute");
}

function enMinutes(hhmm) {
  const [h, m] = String(hhmm || "").slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// `employe` : { heures_calmes_actif, heures_calmes_debut, heures_calmes_fin }. Vrai si on est dans sa plage calme.
export function enHeuresCalmes(employe, maintenant = new Date()) {
  if (!employe?.heures_calmes_actif) return false;
  const debut = enMinutes(employe.heures_calmes_debut);
  const fin = enMinutes(employe.heures_calmes_fin);
  if (debut === fin) return false; // plage vide : jamais calme
  const m = minutesQuebec(maintenant);
  return debut < fin ? m >= debut && m < fin : m >= debut || m < fin;
}

// Retire des `employeIds` ceux qui sont en heures calmes en ce moment (ne bloque rien si les colonnes n'existent pas encore).
export async function sansHeuresCalmes(service, employeIds, maintenant = new Date()) {
  if (employeIds.length === 0) return employeIds;
  const { data, error } = await service.from("employes").select("id, heures_calmes_actif, heures_calmes_debut, heures_calmes_fin").in("id", employeIds);
  if (error || !data) return employeIds;
  const calmes = new Set(data.filter((e) => enHeuresCalmes(e, maintenant)).map((e) => e.id));
  return employeIds.filter((id) => !calmes.has(id));
}
