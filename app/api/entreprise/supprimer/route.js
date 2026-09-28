import { NextResponse } from "next/server";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";

// Permet au PROPRIÉTAIRE d'une entreprise de la supprimer lui-même (avant,
// seul un admin Gozly pouvait le faire). Ne touche jamais au compte de
// connexion ni à ses autres entreprises - contrairement à un compte, une
// entreprise n'a pas d'abonnement Stripe à annuler (il appartient au
// compte, voir supabase/forfait_par_compte.sql).
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { entrepriseId } = await request.json().catch(() => ({}));
  if (!entrepriseId) {
    return NextResponse.json({ error: "entrepriseId manquant." }, { status: 400 });
  }

  const supabase = getSupabaseForToken(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // Vérifie que l'appelant est bien PROPRIÉTAIRE de cette entreprise (pas
  // juste un membre) - via le client authentifié comme lui, RLS oblige.
  const { data: membre } = await supabase
    .from("membres")
    .select("role")
    .eq("entreprise_id", entrepriseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membre?.role !== "proprietaire") {
    return NextResponse.json({ error: "Seul le propriétaire de l'entreprise peut la supprimer." }, { status: 403 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  const { error } = await service.from("entreprises").delete().eq("id", entrepriseId);
  if (error) {
    return NextResponse.json({ error: "La suppression a échoué : " + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
