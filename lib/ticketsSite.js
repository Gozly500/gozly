import { createClient } from "@supabase/supabase-js";
import { getSupabaseForToken } from "@/lib/stripeServer";

// Tickets du site : une personne connectée ouvre un ticket et suit la conversation ; l'équipe répond depuis le
// panneau admin. Tout passe par le serveur avec la clé service_role (tables sans accès direct du navigateur).

export const LIMITES = {
  sujet: 120,
  texte: 2000,
  ticketsOuverts: 3, // par personne, en même temps
  ticketsParJour: 10,
};

// Client sans cache (Next.js met sinon en cache les lectures et les conversations resteraient périmées).
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { global: { fetch: (u, o) => fetch(u, { ...o, cache: "no-store" }) } });
}

// Personne connectée (jeton Supabase dans l'en-tête Authorization), ou null.
export async function utilisateurDepuisRequete(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
  } = await getSupabaseForToken(token).auth.getUser(token);
  return user || null;
}

export function messageTable(error) {
  return /tickets_site/.test(error?.message || "") ? "La base n'est pas prête (SQL tickets_site.sql à exécuter)." : error?.message || "Erreur.";
}
