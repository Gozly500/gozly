import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";

async function annulerAbonnementSi(serviceClient, entrepriseId) {
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
}

export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const serviceClient = getServiceClient();
  if (!serviceClient) {
    return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  const { profilId, entrepriseId, deleteAccount } = await request.json().catch(() => ({}));

  // Un compte peut posséder plusieurs entreprises (ex: deux succursales
  // immatriculées séparément) - supprimer UNE entreprise ne doit jamais
  // supprimer le compte de connexion partagé, sinon on perdrait aussi
  // l'accès aux autres entreprises de ce compte.
  if (!deleteAccount) {
    if (!entrepriseId) {
      return NextResponse.json({ error: "entrepriseId manquant." }, { status: 400 });
    }

    await annulerAbonnementSi(serviceClient, entrepriseId);

    // Supprime l'entreprise (cascade -> membres, employés, planning, pointages).
    const { error: entrepriseError } = await serviceClient.from("entreprises").delete().eq("id", entrepriseId);
    if (entrepriseError) {
      return NextResponse.json({ error: "La suppression a échoué : " + entrepriseError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // Suppression d'un COMPTE (deleteAccount: true) : supprime aussi les
  // entreprises dont ce compte est l'unique membre (sinon elles resteraient
  // orphelines, sans plus personne pour y accéder), mais jamais celles
  // partagées avec d'autres membres.
  if (!profilId) {
    return NextResponse.json({ error: "profilId manquant." }, { status: 400 });
  }

  const { data: mesMembres } = await serviceClient.from("membres").select("entreprise_id").eq("user_id", profilId);

  for (const m of mesMembres || []) {
    const { count } = await serviceClient
      .from("membres")
      .select("id", { count: "exact", head: true })
      .eq("entreprise_id", m.entreprise_id)
      .neq("user_id", profilId);

    if ((count || 0) === 0) {
      await annulerAbonnementSi(serviceClient, m.entreprise_id);
      await serviceClient.from("entreprises").delete().eq("id", m.entreprise_id);
    }
  }

  // Supprime le compte de connexion (cascade -> profils, membres restants).
  const { error: authError } = await serviceClient.auth.admin.deleteUser(profilId);
  if (authError) {
    return NextResponse.json({ error: "La suppression du compte a échoué : " + authError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
