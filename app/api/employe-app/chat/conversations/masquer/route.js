import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

// Supprime une conversation « pour moi » : elle disparaît de la liste de l'employé avec ses messages, de son côté
// seulement (voir supabase/chat_masquer.sql). Le fil « Équipe » ne se supprime pas.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { conversationId } = await request.json().catch(() => ({}));
  if (!conversationId) {
    return NextResponse.json({ error: "Conversation manquante." }, { status: 400 });
  }

  const service = getServiceClient();

  // Seulement une conversation dont l'employé est participant (le fil Équipe n'a pas de participants : refusé).
  const { data: participation } = await service
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("employe_id", employe.id)
    .maybeSingle();
  if (!participation) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { error } = await service
    .from("conversations_masquees")
    .upsert({ employe_id: employe.id, conversation_id: conversationId, masque_le: new Date().toISOString() }, { onConflict: "employe_id,conversation_id" });
  if (error) {
    console.error("Erreur suppression de conversation (pour moi):", error.message);
    return NextResponse.json({ error: "La suppression a échoué (le fichier SQL chat_masquer.sql est-il exécuté ?)." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
