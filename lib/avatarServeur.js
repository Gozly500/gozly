// Lecture des noms (et avatars) pour la messagerie. Tant que supabase/avatars.sql n'est pas exécuté, la colonne
// « avatar » n'existe pas : on relit alors sans elle.
export async function employesAvecAvatar(service, ids) {
  if (!ids.length) return [];
  const avec = await service.from("employes").select("id, nom, avatar").in("id", ids);
  if (!avec.error) return avec.data || [];
  const { data } = await service.from("employes").select("id, nom").in("id", ids);
  return data || [];
}

export async function profilsAvecAvatar(service, ids) {
  if (!ids.length) return [];
  const avec = await service.from("profils").select("id, full_name, avatar").in("id", ids);
  if (!avec.error) return avec.data || [];
  const { data } = await service.from("profils").select("id, full_name").in("id", ids);
  return data || [];
}
