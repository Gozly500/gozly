import { getOrCreateEquipeConversation } from "@/lib/chatServer";

async function compterInventaire(supabase, entrepriseId) {
  const { data } = await supabase.from("produits_inventaire").select("quantite, seuil_alerte").eq("entreprise_id", entrepriseId);
  return (data || []).filter((p) => p.quantite <= p.seuil_alerte).length;
}

async function compterDemandes(supabase, entrepriseId) {
  const [{ count: conges }, { count: echanges }] = await Promise.all([
    supabase
      .from("demandes_conge")
      .select("id", { count: "exact", head: true })
      .eq("entreprise_id", entrepriseId)
      .eq("statut", "en_attente"),
    supabase
      .from("demandes_echange")
      .select("id", { count: "exact", head: true })
      .eq("entreprise_id", entrepriseId)
      .eq("statut_employe", "accepte")
      .eq("statut_admin", "en_attente"),
  ]);
  return (conges || 0) + (echanges || 0);
}

async function compterChatNonLu(supabase, entrepriseId, userId) {
  const equipeId = await getOrCreateEquipeConversation(supabase, entrepriseId);

  const { data: participations } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", userId);
  const conversationIds = [equipeId, ...(participations || []).map((p) => p.conversation_id)];

  const [{ data: lectures }, { data: messages }] = await Promise.all([
    supabase.from("conversation_lectures").select("conversation_id, dernier_lu_a").eq("user_id", userId).in("conversation_id", conversationIds),
    supabase.from("messages").select("conversation_id, user_id, created_at").in("conversation_id", conversationIds),
  ]);

  const dernierLuPar = Object.fromEntries((lectures || []).map((l) => [l.conversation_id, l.dernier_lu_a]));

  return (messages || []).filter((m) => {
    if (m.user_id === userId) return false;
    const seuil = dernierLuPar[m.conversation_id];
    return !seuil || new Date(m.created_at) > new Date(seuil);
  }).length;
}

export async function compterNotifications(supabase, { entrepriseId, userId }) {
  const [inventaire, demandes, chat] = await Promise.all([
    compterInventaire(supabase, entrepriseId),
    compterDemandes(supabase, entrepriseId),
    compterChatNonLu(supabase, entrepriseId, userId),
  ]);

  return { chat, demandes, inventaire, total: chat + demandes + inventaire };
}
