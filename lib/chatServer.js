// Logique de conversations partagée entre les routes employé
// (service_role) et admin (client authentifié RLS) - les deux passent
// un client Supabase déjà configuré, cette fonction ne sait pas lequel.

export async function getOrCreateEquipeConversation(supabase, entrepriseId) {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("entreprise_id", entrepriseId)
    .eq("type", "equipe")
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ entreprise_id: entrepriseId, type: "equipe" })
    .select("id")
    .single();

  if (error) {
    // Deux requêtes concurrentes ont pu tenter de créer le fil équipe en
    // même temps (index unique) - on relit plutôt que d'échouer.
    const { data: retry } = await supabase
      .from("conversations")
      .select("id")
      .eq("entreprise_id", entrepriseId)
      .eq("type", "equipe")
      .maybeSingle();
    if (retry) return retry.id;
    throw error;
  }

  return created.id;
}

// participant: { employeId } ou { userId }
export async function getOrCreateDirecteConversation(supabase, entrepriseId, participantA, participantB) {
  const colA = participantA.employeId ? "employe_id" : "user_id";
  const valA = participantA.employeId || participantA.userId;
  const colB = participantB.employeId ? "employe_id" : "user_id";
  const valB = participantB.employeId || participantB.userId;

  const { data: rowsA } = await supabase.from("conversation_participants").select("conversation_id").eq(colA, valA);
  const idsA = (rowsA || []).map((r) => r.conversation_id);

  if (idsA.length > 0) {
    const { data: rowsB } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq(colB, valB)
      .in("conversation_id", idsA);
    if (rowsB && rowsB.length > 0) return rowsB[0].conversation_id;
  }

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ entreprise_id: entrepriseId, type: "directe" })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("conversation_participants").insert([
    { conversation_id: conv.id, [colA]: valA },
    { conversation_id: conv.id, [colB]: valB },
  ]);

  return conv.id;
}
