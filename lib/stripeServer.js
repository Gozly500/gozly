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

export async function getUserEntreprise(supabase, token) {
  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) return { user: null, entreprise: null };

  const { data: profil } = await supabase
    .from("profils")
    .select("entreprise_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profil?.entreprise_id) return { user, entreprise: null };

  const { data: entreprise } = await supabase
    .from("entreprises")
    .select("*")
    .eq("id", profil.entreprise_id)
    .maybeSingle();

  return { user, entreprise: entreprise || null };
}

export async function getOrCreateStripeCustomer(stripe, supabase, entreprise, user) {
  if (entreprise.stripe_customer_id) return entreprise.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email,
    name: entreprise.nom,
    metadata: { entreprise_id: entreprise.id },
  });

  await supabase.from("entreprises").update({ stripe_customer_id: customer.id }).eq("id", entreprise.id);

  return customer.id;
}
