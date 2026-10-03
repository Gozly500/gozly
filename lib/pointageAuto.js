// Fermeture automatique des pointages oubliés, à partir des horaires
// d'ouverture des succursales (Entreprise > Emplacements). Côté serveur
// (service_role). Un pointage encore ouvert 1 h 30 après la fermeture de sa
// succursale est fermé avec l'heure de FERMETURE comme sortie et marqué
// `sortie_auto` : la feuille de temps affiche « oubli potentiel » et un
// gestionnaire peut corriger l'heure.

import { bornesJour } from "@/lib/commandes";

export const DELAI_FERMETURE_AUTO_MS = 90 * 60 * 1000;

function dateQuebec(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date(iso));
}

// Instant ISO d'une heure "HH:MM" d'une date du Québec ("AAAA-MM-JJ").
function instantQuebec(date, heure) {
  const [h, m] = String(heure).split(":").map(Number);
  return new Date(new Date(bornesJour(date).debut).getTime() + ((h || 0) * 60 + (m || 0)) * 60000);
}

// Heure de fermeture (Date) pour un pointage commencé à `entreeIso`, ou null
// si on ne peut pas la déterminer (jour fermé, pas d'horaire, arrivée après la fermeture).
export function fermetureDuPointage(entreeIso, horaires) {
  if (!horaires) return null;
  const jour = dateQuebec(entreeIso);
  const jourSemaine = new Date(`${jour}T12:00:00Z`).getUTCDay(); // 0 = dimanche
  const h = horaires[String(jourSemaine)];
  if (!h?.debut || !h?.fin) return null;

  const debut = instantQuebec(jour, h.debut);
  let fin = instantQuebec(jour, h.fin);
  if (fin <= debut) fin = new Date(fin.getTime() + 24 * 3600 * 1000); // ferme après minuit
  if (new Date(entreeIso) > fin) return null;
  return fin;
}

// Ferme les pointages oubliés de l'entreprise. Retourne le nombre fermé.
export async function fermerPointagesOublies(service, entrepriseId) {
  const { data: emplacements } = await service
    .from("emplacements")
    .select("id, horaires_ouverture")
    .eq("entreprise_id", entrepriseId);
  if (!emplacements || !emplacements.some((e) => e.horaires_ouverture)) return 0;

  const parId = new Map(emplacements.map((e) => [e.id, e.horaires_ouverture]));
  // Pointage sans succursale enregistrée : on prend celle de l'entreprise si elle n'en a qu'une.
  const horairesParDefaut = emplacements.length === 1 ? emplacements[0].horaires_ouverture : null;

  const { data: ouverts } = await service
    .from("pointages")
    .select("id, entree, emplacement_id")
    .eq("entreprise_id", entrepriseId)
    .is("sortie", null);

  const maintenant = Date.now();
  let fermes = 0;

  for (const p of ouverts || []) {
    const horaires = p.emplacement_id ? parId.get(p.emplacement_id) : horairesParDefaut;
    const fermeture = fermetureDuPointage(p.entree, horaires);
    if (!fermeture || maintenant < fermeture.getTime() + DELAI_FERMETURE_AUTO_MS) continue;

    const { error } = await service
      .from("pointages")
      .update({ sortie: fermeture.toISOString(), sortie_auto: true })
      .eq("id", p.id)
      .is("sortie", null);
    if (!error) fermes++;
  }

  return fermes;
}
