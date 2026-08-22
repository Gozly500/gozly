import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();

  // Exclut les collègues avec qui une conversation directe existe déjà -
  // "Démarrer avec..." ne doit proposer que des gens pas encore contactés.
  const { data: mesParticipations } = await service
    .from("conversation_participants")
    .select("conversation_id")
    .eq("employe_id", employe.id);
  const conversationIds = (mesParticipations || []).map((p) => p.conversation_id);

  let dejaEnDiscussionAvec = new Set();
  if (conversationIds.length > 0) {
    const { data: autresParticipants } = await service
      .from("conversation_participants")
      .select("conversation_id, employe_id")
      .in("conversation_id", conversationIds);
    dejaEnDiscussionAvec = new Set(
      (autresParticipants || []).filter((p) => p.employe_id && p.employe_id !== employe.id).map((p) => p.employe_id)
    );
  }

  const { data: collegues } = await service
    .from("employes")
    .select("id, nom")
    .eq("entreprise_id", employe.entreprise_id)
    .neq("id", employe.id)
    .order("nom", { ascending: true });

  const disponibles = (collegues || []).filter((c) => !dejaEnDiscussionAvec.has(c.id));

  return NextResponse.json({ collegues: disponibles });
}
