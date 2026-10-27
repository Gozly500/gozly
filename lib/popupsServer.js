// Pop-ups d'ouverture (supabase/popups_app.sql) : lecture de ceux qu'une personne n'a pas encore vus, et marquage « vu ».
// Côté serveur seulement (service_role). Une personne est soit un employé (employe_id), soit un utilisateur du tableau de bord (user_id).

export const LIMITES_POPUP = { titre: 120, contenu: 3000 };
export const CIBLES_POPUP = ["employes", "gestion"];

// qui : { cible: "employes" | "gestion", colonne: "employe_id" | "user_id", id }
// Retourne les pop-ups actifs pour cette cible que la personne n'a pas encore vus, les plus anciens d'abord.
export async function popupsNonVus(service, { cible, colonne, id }) {
  const { data: actifs, error } = await service
    .from("popups_app")
    .select("id, titre, contenu, active_le")
    .eq("actif", true)
    .contains("cibles", [cible])
    .order("active_le", { ascending: true })
    .limit(20);
  // Tant que le SQL n'est pas exécuté (table absente), on ne montre rien et on ne plante pas.
  if (error) return [];
  if (!actifs?.length) return [];

  const { data: vus } = await service
    .from("popups_vus")
    .select("popup_id")
    .eq(colonne, id)
    .in(
      "popup_id",
      actifs.map((p) => p.id)
    );
  const dejaVus = new Set((vus || []).map((v) => v.popup_id));
  return actifs.filter((p) => !dejaVus.has(p.id)).map(({ id: popupId, titre, contenu }) => ({ id: popupId, titre, contenu }));
}

// Marque un pop-up comme vu par cette personne (sans effet si c'est déjà fait ou si le pop-up n'existe plus).
export async function marquerPopupVu(service, { colonne, id }, popupId) {
  const { error } = await service.from("popups_vus").insert({ popup_id: popupId, [colonne]: id });
  return !error || error.code === "23505"; // 23505 = déjà marqué
}
