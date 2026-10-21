// Logiciels de bureau Gozly (installables sur Windows). Utilisé par le serveur ET par la page.
// Le forfait appartient au compte (profils.forfait) : voir supabase/forfait_par_compte.sql.

// Forfaits qui ont droit à Go-Page (même règle que dans le logiciel lui-même)
export const FORFAITS_TEXTE = ["onyx", "crystal", "pilote"];

export function forfaitPermetTexte(forfait) {
  return FORFAITS_TEXTE.includes(forfait);
}
