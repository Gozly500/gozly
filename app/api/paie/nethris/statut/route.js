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

  // Ne renvoie jamais les identifiants au client, seulement l'état.
  const { data } = await service
    .from("paie_connexions")
    .select("statut")
    .eq("entreprise_id", entreprise.id)
    .eq("service", "nethris")
    .maybeSingle();

  return NextResponse.json({ connecte: !!data, statut: data?.statut || null });
}
