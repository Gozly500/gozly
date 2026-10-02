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
export function correspondAuLieu(commande, lieuFiltre, { inclureSansLieu = true } = {}) {
  if (!lieuFiltre) return true;
  if (!commande.lieu_nom) return inclureSansLieu;
  return normaliserLieu(commande.lieu_nom) === normaliserLieu(lieuFiltre);
}
