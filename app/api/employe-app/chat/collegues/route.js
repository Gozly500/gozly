import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { chargerRestrictions } from "@/lib/chatRestrictions";

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const { bloques } = await chargerRestrictions(service, employe.id);

  // « Déjà en discussion » = une conversation DIRECTE visible avec cette personne. Avant, on comptait toutes les conversations :
  // quelqu'un qui partageait seulement un GROUPE avec moi (ou une conversation directe supprimée « pour moi ») disparaissait de
  // « Démarrer avec... » et de la recherche, des deux côtés, sans qu'aucune discussion directe n'existe.
  const { data: mesParticipations } = await service
    .from("conversation_participants")
    .select("conversation_id")
    .eq("employe_id", employe.id);
  const conversationIds = (mesParticipations || []).map((p) => p.conversation_id);

  let dejaEnDiscussionAvec = new Set();
  if (conversationIds.length > 0) {
    const { data: conversations } = await service.from("conversations").select("id, type").in("id", conversationIds);
    const directes = (conversations || []).filter((c) => c.type === "directe").map((c) => c.id);

    // Conversations supprimées « pour moi » (supabase/chat_masquer.sql) : elles n'apparaissent plus dans ma liste, donc la personne
    // doit pouvoir être recontactée (la conversation existante est alors rouverte, voir getOrCreateDirecteConversation).
    const { data: masquees, error: erreurMasquees } = await service.from("conversations_masquees").select("conversation_id").eq("employe_id", employe.id);
    const cachees = new Set(erreurMasquees ? [] : (masquees || []).map((m) => m.conversation_id));
    const visibles = directes.filter((id) => !cachees.has(id));

    if (visibles.length > 0) {
      const { data: autresParticipants } = await service
        .from("conversation_participants")
        .select("conversation_id, employe_id")
        .in("conversation_id", visibles);
      dejaEnDiscussionAvec = new Set(
        (autresParticipants || []).filter((p) => p.employe_id && p.employe_id !== employe.id).map((p) => p.employe_id)
      );
    }
  }

  const { data: tousLesCollegues } = await service
    .from("employes")
    .select("id, nom")
    .eq("entreprise_id", employe.entreprise_id)
    .neq("id", employe.id)
    .order("nom", { ascending: true });
  // Les personnes avec qui le propriétaire a coupé la communication n'apparaissent nulle part.
  const collegues = (tousLesCollegues || []).filter((c) => !bloques.has(c.id));

  const disponibles = (collegues || []).filter((c) => !dejaEnDiscussionAvec.has(c.id));

  // `collegues` : ceux pas encore contactés (« Démarrer avec... ») ; `tous` : tout le monde (groupes, recherche).
  return NextResponse.json({
    collegues: disponibles,
    tous: (collegues || []).map((c) => ({ id: c.id, nom: c.nom, dejaEnDiscussion: dejaEnDiscussionAvec.has(c.id) })),
  });
}
