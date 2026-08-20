import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";

export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const serviceClient = getServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  const { profilId, entrepriseId } = await request.json().catch(() => ({}));
  if (!entrepriseId) {
    return NextResponse.json({ error: "entrepriseId manquant." }, { status: 400 });
  }

  // Annule l'abonnement Stripe actif avant de supprimer, pour ne pas
  // continuer à facturer un client dont le compte n'existe plus.
  const { data: entreprise } = await serviceClient
    .from("entreprises")
    .select("stripe_subscription_id")
    .eq("id", entrepriseId)
    .maybeSingle();

  if (entreprise?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.subscriptions.cancel(entreprise.stripe_subscription_id);
    } catch (err) {
      console.error("Échec de l'annulation Stripe lors de la suppression:", err.message);
    }
  }

  // Supprime le compte de connexion (cascade -> profils).
  if (profilId) {
    const { error: authError } = await serviceClient.auth.admin.deleteUser(profilId);
    if (authError) {
      return NextResponse.json(
        { error: "La suppression du compte a échoué : " + authError.message },
        { status: 500 }
      );
    }
  }

  // Supprime l'entreprise (cascade -> employés, planning, pointages).
  const { error: entrepriseError } = await serviceClient.from("entreprises").delete().eq("id", entrepriseId);
  if (entrepriseError) {
    return NextResponse.json(
      {
        error:
          "Le compte a été supprimé, mais les données de l'entreprise n'ont pas pu être effacées : " +
          entrepriseError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
