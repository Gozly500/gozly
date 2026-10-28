// Logiciels de bureau Gozly (installables sur Windows). Utilisé par le serveur ET par la page.
// Le forfait appartient au compte (profils.forfait) : voir supabase/forfait_par_compte.sql.
// La clé (texte, calky...) sert dans les adresses /api/logiciels/<clé> et dans les étiquettes GitHub (texte-v0.1.0).

export const LOGICIELS = {
  texte: { nom: "Textas", forfaits: ["onyx", "crystal", "pilote"] },
  calky: { nom: "Calky", forfaits: ["onyx", "crystal", "pilote"] },
};

export function forfaitPermetLogiciel(forfait, logiciel) {
  return Boolean(LOGICIELS[logiciel]?.forfaits.includes(forfait));
}
