// Rappels « N'oubliez pas d'enregistrer les températures » : 30 minutes avant la fin d'un créneau
// (AM : 11 h 30, PM : 23 h 30, heure du Québec), si personne n'a enregistré de relevé pour ce créneau.
// Activé par l'entreprise dans Personnalisation > Températures (entreprises.temperature_rappels_actif,
// voir supabase/temperature_rappels.sql). Appelé par la tâche planifiée /api/cron/rappels-temperature.

import { dateStr } from "@/lib/temperature";
import { envoyerPushEmployes } from "@/lib/pushServer";

const FUSEAU = "America/Toronto";
const MINUTES_AVANT_FIN = 30;

function heureMinuteQuebec(d) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { h: get("hour"), m: get("minute") };
}

// Créneau dont on est dans la dernière demi-heure ("am" de 11 h 30 à 11 h 59, "pm" de 23 h 30 à 23 h 59), sinon null.
// La tâche planifiée est lancée à l'heure UTC des deux saisons (heure d'été / d'hiver) : seul le lancement
// qui tombe dans cette fenêtre envoie quelque chose, l'autre ne fait rien.
export function creneauARappeler(d = new Date()) {
  const { h, m } = heureMinuteQuebec(d);
  const minutes = h * 60 + m;
  if (minutes >= 12 * 60 - MINUTES_AVANT_FIN && minutes < 12 * 60) return "am";
  if (minutes >= 24 * 60 - MINUTES_AVANT_FIN) return "pm";
  return null;
}

// Employés à prévenir pour un groupe d'équipements : ceux qui sont pointés en ce moment ; à défaut ceux
// dont un quart publié couvre l'heure. Pour un groupe lié à une succursale, seulement ceux qui y sont
// assignés (ce sont les seuls qui voient ces équipements dans l'app).
function cibles({ emplacementId, pointes, quartsMaintenant, assignations }) {
  const assignes = (id) => !emplacementId || assignations.some((a) => a.employe_id === id && a.emplacement_id === emplacementId);
  const duGroupe = (x) => !emplacementId || !x.emplacement_id || x.emplacement_id === emplacementId;

  const pointesIds = pointes.filter(duGroupe).map((p) => p.employe_id).filter(assignes);
  if (pointesIds.length > 0) return [...new Set(pointesIds)];
  return [...new Set(quartsMaintenant.filter(duGroupe).map((q) => q.employe_id).filter(assignes))];
}

// Envoie les rappels de toutes les entreprises concernées. Retourne { creneau, employesPrevenus }.
export async function envoyerRappelsTemperature(service, maintenant = new Date()) {
  const periode = creneauARappeler(maintenant);
  if (!periode) return { creneau: null, employesPrevenus: 0 };

  const date = dateStr(maintenant);
  const { h, m } = heureMinuteQuebec(maintenant);
  const hhmm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

  const { data: entreprises, error } = await service.from("entreprises").select("id").eq("temperature_rappels_actif", true);
  if (error || !entreprises || entreprises.length === 0) return { creneau: periode, employesPrevenus: 0 };

  let prevenus = 0;

  for (const { id: entrepriseId } of entreprises) {
    const { data: module } = await service.from("modules_actifs").select("module").eq("entreprise_id", entrepriseId).eq("module", "temperature").maybeSingle();
    if (!module) continue;

    const [{ data: equipements }, { data: releves }] = await Promise.all([
      service.from("equipements_temperature").select("id, emplacement_id").eq("entreprise_id", entrepriseId),
      service.from("releves_temperature").select("equipement_id").eq("entreprise_id", entrepriseId).eq("date_relevee", date).eq("periode", periode),
    ]);
    if (!equipements || equipements.length === 0) continue;

    // Un groupe par succursale (équipements sans succursale = un groupe partagé) : on rappelle si aucun de ses équipements n'a de relevé.
    const avecReleve = new Set((releves || []).map((r) => r.equipement_id));
    const groupes = new Map();
    for (const eq of equipements) {
      const cle = eq.emplacement_id || "";
      const g = groupes.get(cle) || { emplacementId: eq.emplacement_id || null, fait: false };
      if (avecReleve.has(eq.id)) g.fait = true;
      groupes.set(cle, g);
    }
    const aRappeler = [...groupes.values()].filter((g) => !g.fait);
    if (aRappeler.length === 0) continue;

    const [{ data: pointes }, { data: quarts }, { data: assignations }] = await Promise.all([
      service.from("pointages").select("employe_id, emplacement_id").eq("entreprise_id", entrepriseId).is("sortie", null),
      service
        .from("planning_quarts")
        .select("employe_id, emplacement_id, heure_debut, heure_fin")
        .eq("entreprise_id", entrepriseId)
        .eq("date", date)
        .eq("publie", true),
      service.from("employe_emplacements").select("employe_id, emplacement_id"),
    ]);
    const quartsMaintenant = (quarts || []).filter((q) => q.employe_id && String(q.heure_debut).slice(0, 5) <= hhmm && hhmm < String(q.heure_fin).slice(0, 5));

    const ids = new Set();
    for (const g of aRappeler) {
      for (const id of cibles({ emplacementId: g.emplacementId, pointes: pointes || [], quartsMaintenant, assignations: assignations || [] })) ids.add(id);
    }
    if (ids.size === 0) continue;

    await envoyerPushEmployes(service, [...ids], {
      titre: "Températures",
      corps: "N'oubliez pas d'enregistrer les températures.",
      url: "/moi/temperature",
    }).catch((err) => console.error("Erreur rappel températures:", err));
    prevenus += ids.size;
  }

  return { creneau: periode, employesPrevenus: prevenus };
}
