import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { getOrCreateEquipeConversation } from "@/lib/chatServer";

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const equipeId = await getOrCreateEquipeConversation(service, employe.entreprise_id);

  const { data: mesParticipations } = await service
    .from("conversation_participants")
    .select("conversation_id")
    .eq("employe_id", employe.id);

  const directeIds = (mesParticipations || []).map((p) => p.conversation_id);

  const conversationIds = [equipeId, ...directeIds];

  const { data: dernierMessages } = await service
    .from("messages")
    .select("conversation_id, contenu, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  const dernierParConversation = {};
  for (const m of dernierMessages || []) {
    if (!dernierParConversation[m.conversation_id]) dernierParConversation[m.conversation_id] = m;
  }

  // Résout le nom de l'autre participant pour chaque conversation directe.
  let autresParticipants = [];
  if (directeIds.length > 0) {
    // Pas de .neq("employe_id", ...) ici : pour une conversation avec un
    // admin (employe_id NULL de son côté), NULL <> valeur est NULL en SQL
    // et exclurait à tort sa ligne. On filtre "l'autre" en JS à la place.
    const { data } = await service
      .from("conversation_participants")
      .select("conversation_id, employe_id, user_id")
      .in("conversation_id", directeIds);
    autresParticipants = (data || []).filter((p) => p.employe_id !== employe.id);
  }

  const autresEmployeIds = autresParticipants.filter((p) => p.employe_id).map((p) => p.employe_id);
  const autresUserIds = autresParticipants.filter((p) => p.user_id).map((p) => p.user_id);

  const [{ data: employesAutres }, { data: profilsAutres }] = await Promise.all([
    autresEmployeIds.length > 0
      ? service.from("employes").select("id, nom").in("id", autresEmployeIds)
      : Promise.resolve({ data: [] }),
    autresUserIds.length > 0
      ? service.from("profils").select("id, full_name").in("id", autresUserIds)
      : Promise.resolve({ data: [] }),
  ]);

  function nomAutreParticipant(conversationId) {
    const p = autresParticipants.find((a) => a.conversation_id === conversationId);
    if (!p) return "Conversation";
    if (p.employe_id) return employesAutres?.find((e) => e.id === p.employe_id)?.nom || "Employé";
    return profilsAutres?.find((pr) => pr.id === p.user_id)?.full_name || "Administration";
  }

  const conversations = [
    {
      id: equipeId,
      type: "equipe",
      titre: "Équipe",
      dernierMessage: dernierParConversation[equipeId]?.contenu || null,
      dernierMessageDate: dernierParConversation[equipeId]?.created_at || null,
    },
    ...directeIds.map((id) => ({
      id,
      type: "directe",
      titre: nomAutreParticipant(id),
      dernierMessage: dernierParConversation[id]?.contenu || null,
      dernierMessageDate: dernierParConversation[id]?.created_at || null,
    })),
  ].sort((a, b) => new Date(b.dernierMessageDate || 0) - new Date(a.dernierMessageDate || 0));

  return NextResponse.json({ conversations });
}
