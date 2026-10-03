// Réactions aux messages de la discussion (table message_reactions).
// Côté serveur seulement (service_role).

export const EMOJIS_REACTION = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Réactions des messages donnés : { [messageId]: [{ emoji, nom, mine }] }.
// Si la table n'existe pas encore (SQL pas exécuté), retourne {}.
export async function reactionsDe(service, messageIds, maCle) {
  if (!messageIds || messageIds.length === 0) return {};
  const { data, error } = await service
    .from("message_reactions")
    .select("message_id, participant, nom, emoji")
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });
  if (error) return {};
  const parMessage = {};
  for (const r of data || []) {
    (parMessage[r.message_id] ||= []).push({ emoji: r.emoji, nom: r.nom || "?", mine: r.participant === maCle });
  }
  return parMessage;
}

// Même emoji que ma réaction actuelle : je la retire. Autre emoji : je la remplace. Aucune : je l'ajoute.
export async function basculerReaction(service, { messageId, maCle, nom, emoji }) {
  if (!EMOJIS_REACTION.includes(emoji)) return { error: "Réaction invalide." };

  const { data: existante } = await service
    .from("message_reactions")
    .select("emoji")
    .eq("message_id", messageId)
    .eq("participant", maCle)
    .maybeSingle();

  if (existante?.emoji === emoji) {
    const { error } = await service.from("message_reactions").delete().eq("message_id", messageId).eq("participant", maCle);
    return error ? { error: error.message } : { ok: true };
  }

  const { error } = await service
    .from("message_reactions")
    .upsert({ message_id: messageId, participant: maCle, nom: nom || "", emoji }, { onConflict: "message_id,participant" });
  return error ? { error: error.message } : { ok: true };
}
