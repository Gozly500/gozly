import { NextResponse } from "next/server";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";

// Liste les AUTRES dashboards de l'utilisateur (dont il est propriétaire) qui
// ont déjà Wix connecté : il peut alors réutiliser la même installation de
// l'app Wix au lieu de la réinstaller (même site, plusieurs succursales).
export async function POST(request) {
  const { entrepriseId } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token || !entrepriseId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ entreprises: [] });
  }

  const { data: membres } = await service
    .from("membres")
    .select("entreprise_id")
    .eq("user_id", user.id)
    .eq("role", "proprietaire");

  const autresIds = (membres || []).map((m) => m.entreprise_id).filter((id) => id !== entrepriseId);
  if (autresIds.length === 0) {
    return NextResponse.json({ entreprises: [] });
  }

  const { data: connexions } = await service
    .from("wix_connexions")
    .select("entreprise_id")
    .in("entreprise_id", autresIds)
    .eq("statut", "connecte");

  const idsConnectes = (connexions || []).map((c) => c.entreprise_id);
  if (idsConnectes.length === 0) {
    return NextResponse.json({ entreprises: [] });
  }

  const { data: entreprises } = await service.from("entreprises").select("id, nom").in("id", idsConnectes);

  return NextResponse.json({ entreprises: entreprises || [] });
}
