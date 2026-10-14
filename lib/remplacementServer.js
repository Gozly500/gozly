// Appel de remplaçant (voir supabase/appels_remplacant.sql) : règles partagées par les routes de l'app employé.
// Côté serveur (service_role).

import { bornesJour } from "@/lib/commandes";
import { chargerRestrictions } from "@/lib/chatRestrictions";

const hm = (t) => String(t || "").slice(0, 5);

// Instant (ms) où le quart commence (heure du Québec).
export function debutDuQuart(quart) {
  const [h, m] = hm(quart.heure_debut).split(":").map(Number);
  return new Date(bornesJour(quart.date).debut).getTime() + ((h || 0) * 60 + (m || 0)) * 60000;
}

export function quartPasCommence(quart, maintenant = Date.now()) {
  return debutDuQuart(quart) > maintenant;
}

// Plage visée par l'appel : « HH:MM » début / fin (le quart au complet si l'appel n'en précise pas).
export function plageDeLAppel(appel, quart) {
  return { debut: hm(appel.heure_debut || quart.heure_debut), fin: hm(appel.heure_fin || quart.heure_fin) };
}

// Parmi `candidatIds`, ceux qui peuvent répondre à l'appel :
//  - pas bloqués avec le demandeur (dans un sens comme dans l'autre) ;
//  - pas déjà au travail (quart publié qui chevauche la plage ce jour-là) ;
//  - si le quart est lié à une succursale : assignés à celle-ci (ou sans assignation du tout).
export async function candidatsEligibles(service, appel, quart, candidatIds) {
  const ids = candidatIds.filter((id) => id !== appel.demandeur_id);
  if (ids.length === 0) return [];

  const { bloques } = await chargerRestrictions(service, appel.demandeur_id);
  const plage = plageDeLAppel(appel, quart);

  const [{ data: quartsDuJour }, { data: assignations }] = await Promise.all([
    service.from("planning_quarts").select("employe_id, heure_debut, heure_fin").eq("entreprise_id", appel.entreprise_id).eq("date", quart.date).eq("publie", true).in("employe_id", ids),
    quart.emplacement_id ? service.from("employe_emplacements").select("employe_id, emplacement_id").in("employe_id", ids) : Promise.resolve({ data: [] }),
  ]);

  const occupes = new Set(
    (quartsDuJour || []).filter((q) => hm(q.heure_debut) < plage.fin && hm(q.heure_fin) > plage.debut).map((q) => q.employe_id)
  );
  const succursalesDe = new Map();
  for (const a of assignations || []) {
    if (!succursalesDe.has(a.employe_id)) succursalesDe.set(a.employe_id, new Set());
    succursalesDe.get(a.employe_id).add(a.emplacement_id);
  }

  return ids.filter((id) => {
    if (bloques.has(id) || occupes.has(id)) return false;
    if (!quart.emplacement_id) return true;
    const siennes = succursalesDe.get(id);
    return !siennes || siennes.has(quart.emplacement_id);
  });
}
