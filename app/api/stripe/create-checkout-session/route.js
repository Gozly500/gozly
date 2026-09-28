import { NextResponse } from "next/server";
import { getStripe, getSupabaseForToken, getUserProfil, getOrCreateStripeCustomerCompte } from "@/lib/stripeServer";

const FORFAITS_VALIDES = ["opale", "onyx", "crystal"];

export async function POST(request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "L'abonnement Stripe n'est pas encore configuré. Réessaie plus tard." },
      { status: 501 }
    );
  }

  const { forfait } = await request.json().catch(() => ({}));
  if (!FORFAITS_VALIDES.includes(forfait)) {
    return NextResponse.json({ error: "Forfait invalide." }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const { user, profil } = await getUserProfil(supabase, token);

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!profil) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 400 });
  }

  try {
    const prices = await stripe.prices.list({ lookup_keys: [forfait], limit: 1 });
    const price = prices.data[0];
    if (!price) {
      return NextResponse.json({ error: "Ce forfait n'est pas disponible pour le moment." }, { status: 404 });
    }

    const customerId = await getOrCreateStripeCustomerCompte(stripe, supabase, profil, user);
    const origin = request.headers.get("origin") || new URL(request.url).origin;

    // Si le compte a déjà un abonnement actif, on ne recrée pas de paiement
    // séparé : on redirige plutôt vers le portail pour changer de forfait sur
    // l'abonnement existant (qui couvre toutes ses entreprises).
    if (profil.stripe_subscription_id) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/parametres`,
      });
      return NextResponse.json({ url: portalSession.url });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${origin}/parametres?checkout=success`,
      cancel_url: `${origin}/parametres?checkout=cancel`,
      metadata: { user_id: user.id, forfait },
      subscription_data: { metadata: { user_id: user.id, forfait } },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Stripe checkout session error:", err);
    return NextResponse.json({ error: "Impossible de démarrer le paiement pour le moment." }, { status: 500 });
  }
}
