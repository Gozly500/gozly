import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { majEtLirePresence } from "@/lib/chatPresence";

// "En train d'écrire" / "Vu" côté dashboard : met à jour mon état puis renvoie celui des autres.
export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const supabase = getSupabaseForToken(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { conversationId, ecrit, lu } = await request.json().catch(() => ({}));
  if (!conversationId) return NextResponse.json({ error: "conversationId manquant." }, { status: 400 });

  const service = getServiceClient();
  const { data: conversation } = await service
    .from("conversations")
    .select("id, type, entreprise_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  // Membre de l'entreprise de la conversation (RLS), et participant si ce n'est pas le fil d'équipe.
  const { data: appartenance } = await supabase.from("entreprises").select("id").eq("id", conversation.entreprise_id).maybeSingle();
  if (!appartenance) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  if (conversation.type !== "equipe") {
    const { data: participation } = await service
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!participation) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { data: profil } = await service.from("profils").select("full_name").eq("id", user.id).maybeSingle();
  const etat = await majEtLirePresence(service, {
    conversationId,
    maCle: `u:${user.id}`,
    monNom: profil?.full_name || "Administration",
    ecrit: typeof ecrit === "boolean" ? ecrit : undefined,
    lu: !!lu,
  });
  return NextResponse.json(etat);
}
