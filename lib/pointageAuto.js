// Fermeture automatique des pointages oubliés, à partir des horaires
// d'ouverture des succursales (Entreprise > Emplacements). Côté serveur
// (service_role). Un pointage encore ouvert 1 h 30 après la fermeture de sa
// succursale est fermé et marqué `sortie_auto` : la feuille de temps affiche
// « oubli potentiel » et un gestionnaire peut corriger l'heure. La sortie
// est l'heure de FIN DU QUART prévu à l'horaire de l'employé ce jour-là ; sans
// quart, c'est l'heure de fermeture de la succursale.

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

// Heure de fin (Date) du quart prévu à l'horaire pour ce pointage, ou null s'il n'y en a pas.
// Si l'employé a plusieurs quarts ce jour-là, on prend celui qui commence le plus près de son arrivée.
export function finQuartPrevu(entreeIso, quarts) {
  const jour = dateQuebec(entreeIso);
  const entree = new Date(entreeIso).getTime();
  let meilleur = null;
  let ecart = Infinity;
  for (const q of quarts || []) {
    if (q.date !== jour || !q.heure_debut || !q.heure_fin) continue;
    const debut = instantQuebec(jour, q.heure_debut);
    let fin = instantQuebec(jour, q.heure_fin);
    if (fin <= debut) fin = new Date(fin.getTime() + 24 * 3600 * 1000); // quart qui finit après minuit
    if (fin.getTime() <= entree) continue; // quart déjà fini avant l'arrivée : pas celui-là
    const e = Math.abs(debut.getTime() - entree);
    if (e < ecart) {
      ecart = e;
      meilleur = fin;
    }
  }
  return meilleur;
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
    .select("id, entree, employe_id, emplacement_id")
    .eq("entreprise_id", entrepriseId)
    .is("sortie", null);

  // Quarts prévus des employés concernés, pour sortir à l'heure de fin de leur quart.
  const dates = [...new Set((ouverts || []).map((p) => dateQuebec(p.entree)))];
  const employeIds = [...new Set((ouverts || []).map((p) => p.employe_id))];
  let quarts = [];
  if (dates.length > 0 && employeIds.length > 0) {
    const { data } = await service
      .from("planning_quarts")
      .select("employe_id, date, heure_debut, heure_fin")
      .eq("entreprise_id", entrepriseId)
      .in("employe_id", employeIds)
      .in("date", dates);
    quarts = data || [];
  }

  const maintenant = Date.now();
  let fermes = 0;

  for (const p of ouverts || []) {
    const horaires = p.emplacement_id ? parId.get(p.emplacement_id) : horairesParDefaut;
    const fermeture = fermetureDuPointage(p.entree, horaires);
    if (!fermeture || maintenant < fermeture.getTime() + DELAI_FERMETURE_AUTO_MS) continue;

    // Heure de fin du quart prévu si elle est plausible (après l'arrivée, déjà passée), sinon fermeture.
    const finQuart = finQuartPrevu(p.entree, quarts.filter((q) => q.employe_id === p.employe_id));
    const sortie = finQuart && finQuart.getTime() <= maintenant ? finQuart : fermeture;

    const { error } = await service
      .from("pointages")
      .update({ sortie: sortie.toISOString(), sortie_auto: true })
      .eq("id", p.id)
      .is("sortie", null);
    if (!error) fermes++;
  }

  return fermes;
}
