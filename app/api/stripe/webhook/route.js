import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripeServer";

const FORFAITS_VALIDES = ["opale", "onyx", "crystal"];

export async function POST(request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Webhook Stripe non configuré." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Signature webhook Stripe invalide:", err.message);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  // Le webhook n'a pas de session utilisateur (Stripe appelle directement
  // notre serveur) - on utilise donc la clé service_role, qui contourne les
  // policies RLS. Elle ne doit jamais être exposée côté client.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY manquante - impossible de synchroniser l'abonnement.");
    return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey);

  async function syncEntreprise(customerId, updates) {
    const { error } = await supabase.from("entreprises").update(updates).eq("stripe_customer_id", customerId);
    if (error) console.error("Échec de synchronisation de l'entreprise:", error.message);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.metadata?.forfait) {
        await syncEntreprise(session.customer, {
          forfait: session.metadata.forfait,
          stripe_subscription_id: session.subscription,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const price = subscription.items.data[0]?.price;
      const forfait = FORFAITS_VALIDES.includes(price?.lookup_key) ? price.lookup_key : null;

      if (subscription.status === "active" || subscription.status === "trialing") {
        if (forfait) {
          await syncEntreprise(subscription.customer, { forfait, stripe_subscription_id: subscription.id });
        }
      } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
        await syncEntreprise(subscription.customer, { forfait: null, stripe_subscription_id: null });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await syncEntreprise(subscription.customer, { forfait: null, stripe_subscription_id: null });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
