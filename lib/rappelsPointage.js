// Rappel de pointage : un employé dont le quart publié a commencé depuis 10 minutes et qui n'a toujours pas
// pointé reçoit une notification « N'oublie pas de pointer ». Activé par l'entreprise dans Personnalisation >
// Pointage (entreprises.pointage_rappels_actif, voir supabase/pointage_rappels.sql). Appelé toutes les
// 5 minutes par la planification Supabase (supabase/cron_rappels.sql) via /api/cron/rappels-pointage.
// Fenêtre d'envoi = 5 minutes (de 10 à 15 minutes après le début) : chaque quart n'est rappelé qu'une fois.

import { dateStr } from "@/lib/temperature";
import { bornesJour } from "@/lib/commandes";
import { envoyerPushEmployes } from "@/lib/pushServer";

export const DELAI_RAPPEL_MIN = 10;
export const FENETRE_MIN = 5; // = l'intervalle de la planification
const MARGE_AVANT_QUART_MIN = 180; // un pointage fait jusqu'à 3 h avant le quart compte comme « a pointé »

function minutesQuebec(d) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get("hour") * 60 + get("minute");
}

// Instant (Date) d'une heure "HH:MM" d'une date du Québec ("AAAA-MM-JJ").
function instantQuebec(date, heure) {
  const [h, m] = String(heure).split(":").map(Number);
  return new Date(new Date(bornesJour(date).debut).getTime() + ((h || 0) * 60 + (m || 0)) * 60000);
}

// Quarts à rappeler à cet instant : commencés depuis 10 à 15 minutes (par rapport à `maintenant`).
export function quartsARappeler(quarts, date, maintenant) {
  return (quarts || []).filter((q) => {
    if (!q.employe_id || !q.heure_debut) return false;
    const ecart = (maintenant.getTime() - instantQuebec(date, String(q.heure_debut).slice(0, 5)).getTime()) / 60000;
    return ecart >= DELAI_RAPPEL_MIN && ecart < DELAI_RAPPEL_MIN + FENETRE_MIN;
  });
}

// Envoie les rappels de toutes les entreprises concernées. Retourne { employesPrevenus }.
export async function envoyerRappelsPointage(service, maintenant = new Date()) {
  const date = dateStr(maintenant);

  const { data: entreprises, error } = await service.from("entreprises").select("id").eq("pointage_rappels_actif", true);
  if (error || !entreprises || entreprises.length === 0) return { employesPrevenus: 0 };

  let prevenus = 0;

  for (const { id: entrepriseId } of entreprises) {
    const { data: module } = await service.from("modules_actifs").select("module").eq("entreprise_id", entrepriseId).eq("module", "horaire").maybeSingle();
    if (!module) continue;

    const { data: quarts } = await service
      .from("planning_quarts")
      .select("employe_id, heure_debut")
      .eq("entreprise_id", entrepriseId)
      .eq("date", date)
      .eq("publie", true);

    const aRappeler = quartsARappeler(quarts, date, maintenant);
    if (aRappeler.length === 0) continue;

    const employeIds = [...new Set(aRappeler.map((q) => q.employe_id))];
    const depuis = new Date(maintenant.getTime() - 24 * 3600 * 1000).toISOString();
    const { data: pointages } = await service
      .from("pointages")
      .select("employe_id, entree")
      .eq("entreprise_id", entrepriseId)
      .in("employe_id", employeIds)
      .gte("entree", depuis);

    // A pointé = un pointage (ouvert ou fermé) commencé au plus 3 h avant le début du quart.
    const ids = new Set();
    for (const q of aRappeler) {
      const debut = instantQuebec(date, String(q.heure_debut).slice(0, 5)).getTime();
      const aPointe = (pointages || []).some((p) => p.employe_id === q.employe_id && new Date(p.entree).getTime() >= debut - MARGE_AVANT_QUART_MIN * 60000);
      if (!aPointe) ids.add(q.employe_id);
    }
    if (ids.size === 0) continue;

    await envoyerPushEmployes(service, [...ids], {
      titre: "Pointage",
      corps: `Ton quart a commencé il y a ${DELAI_RAPPEL_MIN} minutes. N'oublie pas de pointer !`,
      url: "/moi/accueil",
    }).catch((err) => console.error("Erreur rappel de pointage:", err));
    prevenus += ids.size;
  }

  return { employesPrevenus: prevenus };
}
