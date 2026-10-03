import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { basculerReaction } from "@/lib/chatReactions";

// Réagir à un message (ou retirer sa réaction) côté employé.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const { messageId, emoji } = await request.json().catch(() => ({}));
  if (!messageId || !emoji) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });

  const service = getServiceClient();
  const { data: message } = await service.from("messages").select("id, conversation_id").eq("id", messageId).maybeSingle();
  if (!message) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });

  const { data: conversation } = await service
    .from("conversations")
    .select("id, type, entreprise_id")
    .eq("id", message.conversation_id)
    .maybeSingle();
  if (!conversation || conversation.entreprise_id !== employe.entreprise_id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  if (conversation.type !== "equipe") {
    const { data: participation } = await service
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", conversation.id)
      .eq("employe_id", employe.id)
      .maybeSingle();
    if (!participation) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const resultat = await basculerReaction(service, { messageId, maCle: `e:${employe.id}`, nom: employe.nom, emoji });
  if (resultat.error) return NextResponse.json({ error: resultat.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
