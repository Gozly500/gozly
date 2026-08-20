import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json(
      { error: "L'abonnement Stripe n'est pas encore configuré. Réessaie plus tard." },
      { status: 501 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // Client Supabase authentifié comme l'utilisateur courant (respecte les
  // règles RLS existantes - un utilisateur ne peut lire/modifier que sa
  // propre entreprise).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { data: profil } = await supabase
    .from("profils")
    .select("entreprise_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profil?.entreprise_id) {
    return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });
  }

  const { data: entreprise } = await supabase
    .from("entreprises")
    .select("*")
    .eq("id", profil.entreprise_id)
    .maybeSingle();

  if (!entreprise) {
    return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
  }

  const stripe = new Stripe(secretKey);
  let customerId = entreprise.stripe_customer_id;

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: entreprise.nom,
        metadata: { entreprise_id: entreprise.id },
      });
      customerId = customer.id;

      await supabase.from("entreprises").update({ stripe_customer_id: customerId }).eq("id", entreprise.id);
    }

    const origin = request.headers.get("origin") || new URL(request.url).origin;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/parametres`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("Stripe portal session error:", err);
    return NextResponse.json(
      { error: "Impossible d'ouvrir le portail Stripe pour le moment." },
      { status: 500 }
    );
  }
}
