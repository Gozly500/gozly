// Restrictions de communication des employés, posées par le propriétaire (Employés > Discussion) :
// voir supabase/chat_restrictions.sql. Côté serveur (service_role). Tant que le SQL n'est pas
// exécuté, tout est permis et rien n'est bloqué (les erreurs « colonne / table absente » sont ignorées).

// { groupes, multi, bloques } : `bloques` = ids des employés avec qui celui-ci ne peut pas communiquer
// (dans un sens comme dans l'autre : s'il a été bloqué OU s'il bloque quelqu'un).
export async function chargerRestrictions(service, employeId) {
  let groupes = true;
  let multi = true;

  const { data: perms, error } = await service
    .from("employes")
    .select("chat_groupes_autorise, chat_multi_autorise")
    .eq("id", employeId)
    .maybeSingle();
  if (!error && perms) {
    groupes = perms.chat_groupes_autorise !== false;
    multi = perms.chat_multi_autorise !== false;
  }

  const bloques = new Set();
  const { data: lignes, error: erreurBlocages } = await service
    .from("chat_blocages")
    .select("employe_id, bloque_id")
    .or(`employe_id.eq.${employeId},bloque_id.eq.${employeId}`);
  if (!erreurBlocages) {
    for (const l of lignes || []) bloques.add(l.employe_id === employeId ? l.bloque_id : l.employe_id);
  }

  return { groupes, multi, bloques };
}

// L'employé a-t-il le droit de créer des rappels ? (colonne de supabase/rappels.sql : lue à part, pour ne pas
// perdre les autres permissions si elle n'existe pas encore - par défaut, c'est permis.)
export async function peutCreerRappels(service, employeId) {
  const { data, error } = await service.from("employes").select("chat_rappels_autorise").eq("id", employeId).maybeSingle();
  if (error || !data) return true;
  return data.chat_rappels_autorise !== false;
}

// Une paire d'employés parmi `ids` est-elle bloquée ? (pour la création d'un groupe)
export async function auMoinsUnePaireBloquee(service, ids) {
  if (ids.length < 2) return false;
  const { data, error } = await service.from("chat_blocages").select("employe_id, bloque_id").in("employe_id", ids).in("bloque_id", ids);
  return !error && (data || []).length > 0;
}

// La conversation est-elle directe avec quelqu'un qui est bloqué pour cet employé ?
export async function conversationDirecteBloquee(service, employeId, conversationId, bloques) {
  if (!bloques || bloques.size === 0) return false;
  const { data: conversation } = await service.from("conversations").select("type").eq("id", conversationId).maybeSingle();
  if (conversation?.type !== "directe") return false;

  const { data: participants } = await service.from("conversation_participants").select("employe_id").eq("conversation_id", conversationId);
  const autre = (participants || []).find((p) => p.employe_id && p.employe_id !== employeId);
  return !!autre && bloques.has(autre.employe_id);
}
