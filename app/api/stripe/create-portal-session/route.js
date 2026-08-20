import { NextResponse } from "next/server";
import { getStripe, getSupabaseForToken, getUserEntreprise, getOrCreateStripeCustomer } from "@/lib/stripeServer";

export async function POST(request) {
  const stripe = getStripe();
  if (!stripe) {
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

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntreprise(supabase, token);

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!entreprise) {
    return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });
  }

  try {
    const customerId = await getOrCreateStripeCustomer(stripe, supabase, entreprise, user);
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
