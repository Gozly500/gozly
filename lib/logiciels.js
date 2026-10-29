// Logiciels Gozly à télécharger (Windows : Textas, Calky ; Android : Gozly Kiosque). Utilisé par le serveur ET par la page.
// Le forfait appartient au compte (profils.forfait) : voir supabase/forfait_par_compte.sql.
// La clé (texte, calky...) sert dans les adresses /api/logiciels/<clé> et dans les étiquettes GitHub (texte-v0.1.0).

export const LOGICIELS = {
  texte: { nom: "Textas", plateforme: "windows", forfaits: ["onyx", "crystal", "pilote"] },
  calky: { nom: "Calky", plateforme: "windows", forfaits: ["onyx", "crystal", "pilote"] },
  // Application Android du kiosque (tablette dédiée) : incluse avec tous les forfaits
  kiosque: { nom: "Gozly Kiosque", plateforme: "android", forfaits: ["opale", "onyx", "crystal", "pilote"] },
};

export function forfaitPermetLogiciel(forfait, logiciel) {
  return Boolean(LOGICIELS[logiciel]?.forfaits.includes(forfait));
}
