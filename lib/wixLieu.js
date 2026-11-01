// Un même site Wix peut alimenter plusieurs dashboards Gozly (un par
// succursale) : chaque dashboard choisit la succursale Wix dont il reçoit les
// commandes (entreprises.wix_lieu_nom, comparée à businessLocation.name).

export function normaliserLieu(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// La commande appartient-elle à ce dashboard ?
// - pas de filtre choisi : toutes ;
// - lieu identique : oui ; autre lieu : non ;
// - commande SANS lieu : `inclureSansLieu` décide (oui pour les commandes à
//   préparer, pour ne rien rater ; non pour les ventes, pour ne pas les
//   compter deux fois quand deux dashboards partagent le même site).
// lieuFiltre : un nom de lieu, ou une liste de noms (succursales liées), ou vide = aucune séparation.
export function correspondAuLieu(commande, lieuFiltre, { inclureSansLieu = true } = {}) {
  const lieux = (Array.isArray(lieuFiltre) ? lieuFiltre : [lieuFiltre]).filter(Boolean);
  if (lieux.length === 0) return true;
  if (!commande.lieu_nom) return inclureSansLieu;
  const lieu = normaliserLieu(commande.lieu_nom);
  return lieux.some((l) => normaliserLieu(l) === lieu);
}

// Quels lieux Wix ce dashboard reçoit-il ? (côté serveur, client service_role)
// - le réglage « Succursale Wix de ce dashboard » (Personnalisation), s'il est choisi ;
// - sinon, si TOUTES les succursales (emplacements) de Gozly sont liées à un lieu Wix : la liste de ces lieux
//   (un dashboard avec une seule succursale liée ne reçoit que les commandes de ce lieu) ;
// - sinon null : toutes les commandes (le tri par succursale se fait à l'affichage).
// Colonne emplacements.wix_lieu_nom absente (emplacements_wix_lieu.sql pas exécuté) : on ne filtre pas.
export async function lieuFiltreDashboard(service, entreprise) {
  if (entreprise?.wix_lieu_nom) return entreprise.wix_lieu_nom;
  const { data, error } = await service.from("emplacements").select("*").eq("entreprise_id", entreprise.id);
  if (error || !data || data.length === 0) return null;
  const liens = data.map((e) => e.wix_lieu_nom).filter(Boolean);
  return liens.length === data.length ? liens : null;
}
