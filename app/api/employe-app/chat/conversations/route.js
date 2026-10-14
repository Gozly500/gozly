import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { getOrCreateEquipeConversation } from "@/lib/chatServer";
import { chargerRestrictions, peutCreerRappels } from "@/lib/chatRestrictions";

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const equipeId = await getOrCreateEquipeConversation(service, employe.entreprise_id);
  const restrictions = await chargerRestrictions(service, employe.id);

  const { data: mesParticipations } = await service
    .from("conversation_participants")
    .select("conversation_id")
    .eq("employe_id", employe.id);

  const privesIds = (mesParticipations || []).map((p) => p.conversation_id);

  // Type (directe / groupe) et nom des groupes.
  const { data: infos } =
    privesIds.length > 0
      ? await service.from("conversations").select("id, type, titre").in("id", privesIds)
      : { data: [] };
  const infoPar = Object.fromEntries((infos || []).map((c) => [c.id, c]));
  const directeIds = privesIds.filter((id) => infoPar[id]?.type !== "groupe");
  const groupeIds = privesIds.filter((id) => infoPar[id]?.type === "groupe");

  const conversationIds = [equipeId, ...privesIds];

  const { data: dernierMessages } = await service
    .from("messages")
    .select("conversation_id, contenu, created_at, employe_id")
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

  function autreEmployeId(conversationId) {
    return autresParticipants.find((a) => a.conversation_id === conversationId)?.employe_id || null;
  }

  function nomAutreParticipant(conversationId) {
    const p = autresParticipants.find((a) => a.conversation_id === conversationId);
    if (!p) return "Conversation";
    if (p.employe_id) return employesAutres?.find((e) => e.id === p.employe_id)?.nom || "Employé";
    return profilsAutres?.find((pr) => pr.id === p.user_id)?.full_name || "Administration";
  }

  // Conversations supprimées « pour moi » (supabase/chat_masquer.sql) : cachées tant qu'aucun message plus récent n'est arrivé.
  const masquees = {};
  const { data: lignesMasquees, error: erreurMasquees } = await service.from("conversations_masquees").select("conversation_id, masque_le").eq("employe_id", employe.id);
  if (!erreurMasquees) for (const m of lignesMasquees || []) masquees[m.conversation_id] = m.masque_le;

  // Conversations en sourdine (supabase/notifications_sourdine.sql) : pas de notification, la conversation reste visible.
  const sourdines = new Set();
  const { data: lignesSourdine, error: erreurSourdine } = await service.from("conversations_sourdine").select("conversation_id").eq("employe_id", employe.id);
  if (!erreurSourdine) for (const l of lignesSourdine || []) sourdines.add(l.conversation_id);

  const conversations = [
    {
      id: equipeId,
      type: "equipe",
      titre: "Équipe",
      dernierMessage: dernierParConversation[equipeId]?.contenu || null,
      dernierMessageDate: dernierParConversation[equipeId]?.created_at || null,
      dernierDeMoi: dernierParConversation[equipeId]?.employe_id === employe.id,
    },
    ...directeIds.map((id) => ({
      id,
      type: "directe",
      titre: nomAutreParticipant(id),
      autreEmployeId: autreEmployeId(id),
      // Le propriétaire a coupé la communication avec cette personne : on voit la conversation, sans pouvoir écrire.
      bloquee: !!autreEmployeId(id) && restrictions.bloques.has(autreEmployeId(id)),
      dernierMessage: dernierParConversation[id]?.contenu || null,
      dernierMessageDate: dernierParConversation[id]?.created_at || null,
      dernierDeMoi: dernierParConversation[id]?.employe_id === employe.id,
    })),
    ...groupeIds.map((id) => ({
      id,
      type: "groupe",
      titre: infoPar[id]?.titre || "Groupe",
      dernierMessage: dernierParConversation[id]?.contenu || null,
      dernierMessageDate: dernierParConversation[id]?.created_at || null,
      dernierDeMoi: dernierParConversation[id]?.employe_id === employe.id,
    })),
  ]
    .filter((c) => !masquees[c.id] || (c.dernierMessageDate && new Date(c.dernierMessageDate) > new Date(masquees[c.id])))
    .map((c) => ({ ...c, sourdine: sourdines.has(c.id) }))
    .sort((a, b) => new Date(b.dernierMessageDate || 0) - new Date(a.dernierMessageDate || 0));

  return NextResponse.json({ conversations, permissions: { groupes: restrictions.groupes, multi: restrictions.multi, rappels: await peutCreerRappels(service, employe.id) } });
}
