import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

// Met une conversation en sourdine (ou la réactive) : plus de notification de ses nouveaux messages pour cet
// employé (supabase/notifications_sourdine.sql). Vaut aussi pour le fil Équipe.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { conversationId, sourdine } = await request.json().catch(() => ({}));
  if (!conversationId || typeof sourdine !== "boolean") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const service = getServiceClient();

  // Le fil Équipe de son entreprise, ou une conversation dont il est participant.
  const { data: conversation } = await service.from("conversations").select("id, type, entreprise_id").eq("id", conversationId).maybeSingle();
  if (!conversation || conversation.entreprise_id !== employe.entreprise_id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  if (conversation.type !== "equipe") {
    const { data: participation } = await service
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("employe_id", employe.id)
      .maybeSingle();
    if (!participation) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }
  }

  const requete = sourdine
    ? service.from("conversations_sourdine").upsert({ employe_id: employe.id, conversation_id: conversationId }, { onConflict: "employe_id,conversation_id" })
    : service.from("conversations_sourdine").delete().eq("employe_id", employe.id).eq("conversation_id", conversationId);
  const { error } = await requete;
  if (error) {
    console.error("Erreur sourdine:", error.message);
    return NextResponse.json({ error: "L'enregistrement a échoué (le fichier SQL notifications_sourdine.sql est-il exécuté ?)." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
