import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { basculerReaction, reactionsDe } from "@/lib/chatReactions";

// Vérifie que l'appelant (dashboard) est membre de l'entreprise de la conversation,
// et participant si ce n'est pas le fil d'équipe. Retourne { user, service } ou une réponse d'erreur.
async function verifier(request, conversationId) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return { erreur: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };

  const supabase = getSupabaseForToken(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return { erreur: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };

  const service = getServiceClient();
  const { data: conversation } = await service
    .from("conversations")
    .select("id, type, entreprise_id")
    .eq("id", conversationId)
    .maybeSingle();
  const refus = { erreur: NextResponse.json({ error: "Accès refusé." }, { status: 403 }) };
  if (!conversation) return refus;

  const { data: appartenance } = await supabase.from("entreprises").select("id").eq("id", conversation.entreprise_id).maybeSingle();
  if (!appartenance) return refus;
  if (conversation.type !== "equipe") {
    const { data: participation } = await service
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!participation) return refus;
  }
  return { user, service };
}

// Réactions de tous les messages d'une conversation.
export async function GET(request) {
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "conversationId manquant." }, { status: 400 });

  const { erreur, user, service } = await verifier(request, conversationId);
  if (erreur) return erreur;

  const { data: messages } = await service.from("messages").select("id").eq("conversation_id", conversationId);
  const reactions = await reactionsDe(service, (messages || []).map((m) => m.id), `u:${user.id}`);
  return NextResponse.json({ reactions });
}

// Réagir à un message (ou retirer sa réaction).
export async function POST(request) {
  const { messageId, emoji } = await request.json().catch(() => ({}));
  if (!messageId || !emoji) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const service0 = getServiceClient();
  const { data: message } = await service0.from("messages").select("id, conversation_id").eq("id", messageId).maybeSingle();
  if (!message) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });

  const { erreur, user, service } = await verifier(request, message.conversation_id);
  if (erreur) return erreur;

  const { data: profil } = await service.from("profils").select("full_name").eq("id", user.id).maybeSingle();
  const resultat = await basculerReaction(service, {
    messageId,
    maCle: `u:${user.id}`,
    nom: profil?.full_name || "Administration",
    emoji,
  });
  if (resultat.error) return NextResponse.json({ error: resultat.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
