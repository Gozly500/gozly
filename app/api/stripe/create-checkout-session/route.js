import { NextResponse } from "next/server";
import { getStripe, getSupabaseForToken, getUserProfil, getOrCreateStripeCustomerCompte } from "@/lib/stripeServer";
import { PERIODES, cleStripe } from "@/lib/forfaitsPrix";
import { BLOCS_MAX, prixExtra } from "@/lib/employesExtraServer";

const FORFAITS_VALIDES = ["opale", "onyx", "crystal"];

export async function POST(request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "L'abonnement Stripe n'est pas encore configuré. Réessaie plus tard." },
      { status: 501 }
    );
  }

  const { forfait, periode: periodeDemandee, blocs: blocsDemandes } = await request.json().catch(() => ({}));
  const periode = PERIODES.includes(periodeDemandee) ? periodeDemandee : "mensuel";
  // Employés en extra à l'inscription : nombre de blocs de 5 (0 = aucun).
  const blocs = Number.isInteger(blocsDemandes) && blocsDemandes > 0 ? Math.min(blocsDemandes, BLOCS_MAX) : 0;

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);

  // Forfait offert + clé de recherche Stripe de la période, lus dans la base (Admin > Abonnements). Si la table n'existe pas
  // encore (SQL pas exécuté), on retombe sur les noms d'origine (opale / opale_annuel...).
  let cleRecherche = null;
  const { data: forfaitDb, error: erreurForfaits } = await supabase.from("forfaits").select("id, publique, actif").eq("id", forfait || "").maybeSingle();
  if (erreurForfaits) {
    if (!FORFAITS_VALIDES.includes(forfait)) return NextResponse.json({ error: "Forfait invalide." }, { status: 400 });
    cleRecherche = cleStripe(forfait, periode);
  } else {
    if (!forfaitDb || !forfaitDb.publique || !forfaitDb.actif) return NextResponse.json({ error: "Forfait invalide." }, { status: 400 });
    const { data: cleDb } = await supabase.from("forfaits_cles").select("cle").eq("forfait_id", forfait).eq("periode", periode).limit(1).maybeSingle();
    cleRecherche = cleDb?.cle || cleStripe(forfait, periode);
  }

  const { user, profil } = await getUserProfil(supabase, token);

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!profil) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 400 });
  }

  try {
    const prices = await stripe.prices.list({ lookup_keys: [cleRecherche], active: true, limit: 1 });
    const price = prices.data[0];
    if (!price) {
      console.error(`[checkout] Aucun prix Stripe actif avec la clé de recherche « ${cleRecherche} ».`);
      return NextResponse.json({ error: `Ce forfait n'est pas disponible pour le moment. (clé : ${cleRecherche})` }, { status: 404 });
    }

    let ligneExtra = null;
    if (blocs > 0) {
      const prixBloc = await prixExtra(stripe, periode);
      if (!prixBloc) return NextResponse.json({ error: "Les employés supplémentaires ne sont pas disponibles pour le moment." }, { status: 404 });
      ligneExtra = { price: prixBloc.id, quantity: blocs };
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
      line_items: ligneExtra ? [{ price: price.id, quantity: 1 }, ligneExtra] : [{ price: price.id, quantity: 1 }],
      allow_promotion_codes: true, // champ « code promo » sur la page de paiement
      success_url: `${origin}/parametres?checkout=success`,
      cancel_url: `${origin}/parametres?checkout=cancel`,
      metadata: { user_id: user.id, forfait, periode, employes_blocs: String(blocs) },
      subscription_data: { metadata: { user_id: user.id, forfait, periode, employes_blocs: String(blocs) } },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Stripe checkout session error:", err);
    return NextResponse.json({ error: "Impossible de démarrer le paiement pour le moment." }, { status: 500 });
  }
}
