// Équipements de température d'une entreprise, dans l'ordre choisi par le gestionnaire (colonne `ordre` de
// supabase/equipements_temperature_ordre.sql), puis par nom. Tant que le SQL n'est pas exécuté, on retombe sur
// l'ordre alphabétique d'avant. `client` : client Supabase (navigateur ou service_role).
export async function chargerEquipements(client, entrepriseId) {
  const base = () => client.from("equipements_temperature").select("*").eq("entreprise_id", entrepriseId);
  const avecOrdre = await base().order("ordre", { ascending: true }).order("nom", { ascending: true });
  if (!avecOrdre.error) return avecOrdre.data || [];
  const { data } = await base().order("nom", { ascending: true });
  return data || [];
}
