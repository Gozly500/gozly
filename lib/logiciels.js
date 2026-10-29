// Logiciels Gozly à télécharger (Windows : Textas, Calky ; Android : Gozly Kiosque). Utilisé par le serveur ET par la page.
// Le forfait appartient au compte (profils.forfait) : voir supabase/forfait_par_compte.sql.
// La clé (texte, calky...) sert dans les adresses /api/logiciels/<clé> et dans les étiquettes GitHub (texte-v0.1.0).
// slug : l'adresse de la page d'installation (/telecharger/<slug>), où le téléchargement démarre.
// majPublique : la source des mises à jour automatiques (/api/logiciels/<clé>/maj) ne demande pas de connexion (l'app n'a pas de compte).
// Le forfait « pilote » garde son accès mais n'est JAMAIS nommé sur le site public (il se donne par un administrateur Gozly).

export const LOGICIELS = {
  texte: { nom: "Textas", slug: "textas", plateforme: "windows", forfaits: ["onyx", "crystal", "pilote"] },
  calky: { nom: "Calky", slug: "calky", plateforme: "windows", forfaits: ["onyx", "crystal", "pilote"] },
  // Application Android du kiosque (tablette dédiée) : incluse avec tous les forfaits
  kiosque: { nom: "Gozly Kiosque", slug: "kiosque-android", plateforme: "android", forfaits: ["opale", "onyx", "crystal", "pilote"] },
  // Application Windows du kiosque (ordinateur ou écran tactile de comptoir) : incluse avec tous les forfaits
  "kiosque-pc": { nom: "Gozly Kiosque", slug: "kiosque-windows", plateforme: "windows", forfaits: ["opale", "onyx", "crystal", "pilote"], majPublique: true },
};

export function forfaitPermetLogiciel(forfait, logiciel) {
  return Boolean(LOGICIELS[logiciel]?.forfaits.includes(forfait));
}

// « textas » -> « texte » (clé du logiciel), ou null si l'adresse ne correspond à aucun logiciel
export function cleParSlug(slug) {
  return Object.keys(LOGICIELS).find((cle) => LOGICIELS[cle].slug === slug) || null;
}
