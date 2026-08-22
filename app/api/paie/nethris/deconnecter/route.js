import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntreprise } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";

export async function POST(request) {
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

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "La connexion aux services de paie n'est pas encore configurée." }, { status: 501 });
  }

  const { error } = await service
    .from("paie_connexions")
    .delete()
    .eq("entreprise_id", entreprise.id)
    .eq("service", "nethris");

  if (error) {
    console.error("Erreur déconnexion Nethris:", error);
    return NextResponse.json({ error: "La déconnexion a échoué." }, { status: 500 });
  }

  return NextResponse.json({ connecte: false });
}
