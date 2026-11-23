// Lecture des noms (et de l'émoji de profil des employés) pour la messagerie. Tant que supabase/employe_emoji.sql n'est pas exécuté,
// la colonne « emoji » n'existe pas : on relit alors sans elle. Les comptes de l'administration n'ont pas d'émoji (leur initiale s'affiche).
export async function employesAvecEmoji(service, ids) {
  if (!ids.length) return [];
  const avec = await service.from("employes").select("id, nom, emoji").in("id", ids);
  if (!avec.error) return avec.data || [];
  const { data } = await service.from("employes").select("id, nom").in("id", ids);
  return data || [];
}

export async function profilsNoms(service, ids) {
  if (!ids.length) return [];
  const { data } = await service.from("profils").select("id, full_name").in("id", ids);
  return data || [];
}
