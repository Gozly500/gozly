import { supabase } from "@/lib/supabaseClient";

// Lit la demande de compte développeur de l'utilisateur ({ statut } ou null).
export async function lireDemandeDeveloppeur(userId) {
  const { data } = await supabase.from("demandes_developpeur").select("statut").eq("profil_id", userId).maybeSingle();
  return data || null;
}

// Envoie la demande (une seule par compte). Renvoie { statut, nouvelle } ou { erreur }.
export async function envoyerDemandeDeveloppeur(userId) {
  const existante = await lireDemandeDeveloppeur(userId);
  if (existante) return { statut: existante.statut, nouvelle: false };
  const { error } = await supabase.from("demandes_developpeur").insert({ profil_id: userId });
  if (error) return { erreur: error.message };
  return { statut: "en_attente", nouvelle: true };
}
