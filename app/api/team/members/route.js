import { NextResponse } from "next/server";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";

export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const supabase = getSupabaseForToken(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const entrepriseId = searchParams.get("entrepriseId");
  if (!entrepriseId) return NextResponse.json({ error: "entrepriseId manquant." }, { status: 400 });

  const { data: monMembership } = await supabase
    .from("membres")
    .select("id")
    .eq("entreprise_id", entrepriseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!monMembership) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  const serviceClient = getServiceClient();
  if (!serviceClient) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  const { data: membres } = await serviceClient.from("membres").select("*").eq("entreprise_id", entrepriseId);

  const { data: usersPage } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((usersPage?.users || []).map((u) => [u.id, u.email]));

  const rows = (membres || []).map((m) => ({ ...m, email: emailById.get(m.user_id) || m.user_id }));

  return NextResponse.json({ membres: rows });
}
