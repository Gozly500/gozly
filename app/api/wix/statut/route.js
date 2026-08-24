import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntreprise } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";

export async function GET(request) {
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
    return NextResponse.json({ connecte: false });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ connecte: false });
  }

  const { data: connexion } = await service
    .from("wix_connexions")
    .select("statut")
    .eq("entreprise_id", entreprise.id)
    .maybeSingle();

  return NextResponse.json({
    connecte: connexion?.statut === "connecte",
    enAttente: connexion?.statut === "en_attente",
  });
}
