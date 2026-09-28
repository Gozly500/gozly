import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

// Client Supabase authentifié comme l'utilisateur courant (respecte les
// règles RLS existantes - un utilisateur ne peut lire/modifier que sa
// propre entreprise).
export function getSupabaseForToken(token) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Résout l'entreprise à partir d'un id fourni par le client (celle
// actuellement active dans son tableau de bord) - un compte pouvant
// posséder plusieurs entreprises, on ne peut jamais deviner "la" bonne
// côté serveur sans que le client la précise.
// Sécurité : le select passe par le client authentifié comme l'utilisateur
// (RLS "un utilisateur peut lire sa propre entreprise" = est_membre(id)),
// donc un entrepriseId d'une entreprise à laquelle il n'appartient pas
// retombe simplement sur "entreprise: null", jamais une fuite de données.
export async function getUserEntrepriseParId(supabase, token, entrepriseId) {
  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user || !entrepriseId) return { user, entreprise: null };

  const { data: entreprise } = await supabase.from("entreprises").select("*").eq("id", entrepriseId).maybeSingle();

  return { user, entreprise: entreprise || null };
}

// Le forfait/abonnement appartient au COMPTE (une seule facture pour toutes
// les entreprises qu'il possède, voir supabase/forfait_par_compte.sql) - pas
// à une entreprise en particulier. Un propriétaire qui veut une facture
// séparée pour une autre entreprise utilise un compte différent.
export async function getUserProfil(supabase, token) {
  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) return { user: null, profil: null };

  const { data: profil } = await supabase.from("profils").select("*").eq("id", user.id).maybeSingle();

  return { user, profil: profil || null };
}

export async function getOrCreateStripeCustomerCompte(stripe, supabase, profil, user) {
  if (profil.stripe_customer_id) return profil.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.user_metadata?.full_name || user.email,
    metadata: { user_id: user.id },
  });

  // Client service_role : stripe_customer_id est protégé (voir
  // supabase/forfait_par_compte.sql) et ne peut pas être écrit avec la
  // session de l'utilisateur.
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  await service.from("profils").update({ stripe_customer_id: customer.id }).eq("id", profil.id);

  return customer.id;
}
