// Pop-ups d'ouverture (supabase/popups_app.sql et popups_app_dates_bouton.sql) : lecture de ceux qu'une personne n'a pas
// encore vus, et marquage « vu ». Côté serveur seulement (service_role). Une personne est soit un employé (employe_id),
// soit un utilisateur du tableau de bord (user_id).

export const LIMITES_POPUP = { titre: 120, contenu: 3000, boutonTexte: 40, boutonUrl: 500 };
export const CIBLES_POPUP = ["employes", "gestion"];

// Un lien de bouton : adresse complète (http/https) ou chemin de l'app qui commence par « / » (jamais « // »).
export function lienValide(url) {
  return /^https?:\/\/[^\s]+$/i.test(url) || /^\/(?!\/)[^\s]*$/.test(url);
}

// Le pop-up est-il dans sa période d'affichage ? (début/fin vides = sans limite)
export function dansLaPeriode(p, maintenant = Date.now()) {
  if (p.debut_le && new Date(p.debut_le).getTime() > maintenant) return false;
  if (p.fin_le && new Date(p.fin_le).getTime() < maintenant) return false;
  return true;
}

// qui : { cible: "employes" | "gestion", colonne: "employe_id" | "user_id", id }
// Retourne les pop-ups actifs pour cette cible, dans leur période, que la personne n'a pas encore vus (les plus anciens d'abord).
export async function popupsNonVus(service, { cible, colonne, id }) {
  const requete = (colonnes) =>
    service.from("popups_app").select(colonnes).eq("actif", true).contains("cibles", [cible]).order("active_le", { ascending: true }).limit(20);
  let { data: actifs, error } = await requete("id, titre, contenu, debut_le, fin_le, bouton_texte, bouton_url, titre_en, contenu_en, bouton_texte_en");
  // Colonnes des SQL de suite pas encore là (anglais : popups_app_anglais.sql ; dates et bouton : popups_app_dates_bouton.sql) : on relit sans.
  if (error) ({ data: actifs, error } = await requete("id, titre, contenu, debut_le, fin_le, bouton_texte, bouton_url"));
  if (error) ({ data: actifs, error } = await requete("id, titre, contenu"));
  // Tant que le SQL n'est pas exécuté (table absente), on ne montre rien et on ne plante pas.
  if (error || !actifs?.length) return [];
  actifs = actifs.filter((p) => dansLaPeriode(p));
  if (!actifs.length) return [];

  const { data: vus } = await service
    .from("popups_vus")
    .select("popup_id")
    .eq(colonne, id)
    .in(
      "popup_id",
      actifs.map((p) => p.id)
    );
  const dejaVus = new Set((vus || []).map((v) => v.popup_id));
  return actifs
    .filter((p) => !dejaVus.has(p.id))
    .map((p) => ({
      id: p.id,
      titre: p.titre,
      contenu: p.contenu,
      boutonTexte: p.bouton_texte || null,
      boutonUrl: p.bouton_url || null,
      // Version anglaise facultative : la personne voit la française si l'anglaise est vide.
      titreEn: p.titre_en || null,
      contenuEn: p.contenu_en || null,
      boutonTexteEn: p.bouton_texte_en || null,
    }));
}

// Marque un pop-up comme vu par cette personne (sans effet si c'est déjà fait ou si le pop-up n'existe plus).
export async function marquerPopupVu(service, { colonne, id }, popupId) {
  const { error } = await service.from("popups_vus").insert({ popup_id: popupId, [colonne]: id });
  return !error || error.code === "23505"; // 23505 = déjà marqué
}
