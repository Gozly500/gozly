import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { majEtLirePresence } from "@/lib/chatPresence";

// "En train d'écrire" / "Vu" côté employé : met à jour mon état puis renvoie celui des autres.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const { conversationId, ecrit, lu } = await request.json().catch(() => ({}));
  if (!conversationId) return NextResponse.json({ error: "conversationId manquant." }, { status: 400 });

  const service = getServiceClient();
  const { data: conversation } = await service
    .from("conversations")
    .select("id, type, entreprise_id")
    .eq("id", conversationId)
    .maybeSingle();
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
    if (!participation) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const etat = await majEtLirePresence(service, {
    conversationId,
    maCle: `e:${employe.id}`,
    monNom: employe.nom,
    ecrit: typeof ecrit === "boolean" ? ecrit : undefined,
    lu: !!lu,
  });
  return NextResponse.json(etat);
}
