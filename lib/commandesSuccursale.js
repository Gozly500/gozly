// À quelle succursale (emplacement Gozly) appartient une commande ?
// Wix donne le lieu de la commande (businessLocation.name, enregistré dans lieu_nom) ; les commandes saisies à la
// main reçoivent le nom de la succursale choisie. On compare avec le nom de chaque succursale de Gozly
// (« Ste-Marthe » correspond à « Pasta Sainte-Marthe-sur-le-Lac » : accents, tirets et « Saint/Sainte/St/Ste » ne comptent pas).
// Un lieu inconnu ne correspond à aucune succursale : la commande reste visible partout, pour ne rien rater.

import { normaliserLieu } from "@/lib/wixLieu";

function cle(s) {
  return normaliserLieu(s)
    .replace(/[-_.,]/g, " ")
    .replace(/\b(saint|sainte|ste|st)\b/g, "st") // Saint, Sainte, St et Ste : même chose
    .replace(/\s+/g, " ")
    .trim();
}

// Id de la succursale de la commande : l'unique succursale s'il n'y en a qu'une, celle dont le nom correspond
// au lieu de la commande, sinon null (lieu absent ou inconnu).
export function emplacementDeCommande(commande, emplacements) {
  if (!emplacements || emplacements.length === 0) return null;
  if (emplacements.length === 1) return emplacements[0].id;
  const lieu = cle(commande?.lieu_nom);
  if (!lieu) return null;
  let meilleur = null;
  for (const e of emplacements) {
    const nom = cle(e.nom);
    if (!nom || !(lieu.includes(nom) || nom.includes(lieu))) continue;
    if (!meilleur || nom.length > cle(meilleur.nom).length) meilleur = e;
  }
  return meilleur ? meilleur.id : null;
}

// La commande doit-elle s'afficher pour cette succursale ? (aucune succursale choisie : toutes)
export function commandeDeSuccursale(commande, emplacementId, emplacements) {
  if (!emplacementId || !emplacements || emplacements.length < 2) return true;
  const id = emplacementDeCommande(commande, emplacements);
  return id === null || id === emplacementId;
}
