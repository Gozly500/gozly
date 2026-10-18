import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { chargerRestrictions, auMoinsUnePaireBloquee } from "@/lib/chatRestrictions";

// Crée un groupe de discussion entre employés (l'employé qui le crée + les collègues choisis).
// Les gens du dashboard ne le voient pas, sauf s'ils sont ajoutés comme participants depuis le dashboard.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const corps = await request.json().catch(() => ({}));
  const titre = typeof corps.titre === "string" ? corps.titre.trim().slice(0, 60) : "";
  const ids = [...new Set(Array.isArray(corps.employeIds) ? corps.employeIds.map(String) : [])].filter((id) => id !== employe.id).slice(0, 50);

  if (!titre) {
    return NextResponse.json({ error: "Donne un nom au groupe." }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "Choisis au moins un collègue." }, { status: 400 });
  }

  const service = getServiceClient();

  const restrictions = await chargerRestrictions(service, employe.id);
  if (!restrictions.groupes) {
    return NextResponse.json({ error: "La création de groupes n'est pas autorisée pour ton compte." }, { status: 403 });
  }

  // Tous les membres choisis doivent être des employés de la même entreprise.
  const { data: membres } = await service.from("employes").select("id").eq("entreprise_id", employe.entreprise_id).in("id", ids);
  if ((membres || []).length !== ids.length) {
    return NextResponse.json({ error: "Collègue introuvable." }, { status: 404 });
  }

  // Personne dans le groupe ne doit être bloqué avec quelqu'un d'autre du groupe (créateur compris).
  if (await auMoinsUnePaireBloquee(service, [employe.id, ...ids])) {
    return NextResponse.json({ error: "Ce groupe ne peut pas être créé avec ces personnes." }, { status: 403 });
  }

  const conversationId = crypto.randomUUID();
  const { error } = await service
    .from("conversations")
    .insert({ id: conversationId, entreprise_id: employe.entreprise_id, type: "groupe", titre });
  if (error) {
    console.error("Erreur création groupe (employé):", error.message);
    return NextResponse.json({ error: "Impossible de créer le groupe." }, { status: 500 });
  }

  // Le créateur est administrateur du groupe (colonne de supabase/chat_groupes_gestion.sql : sans elle, on crée sans rôle).
  const lignes = [employe.id, ...ids].map((employeId) => ({ conversation_id: conversationId, employe_id: employeId }));
  let { error: erreurParticipants } = await service
    .from("conversation_participants")
    .insert(lignes.map((l) => (l.employe_id === employe.id ? { ...l, est_admin: true } : l)));
  if (erreurParticipants) ({ error: erreurParticipants } = await service.from("conversation_participants").insert(lignes));
  if (erreurParticipants) {
    console.error("Erreur participants du groupe:", erreurParticipants.message);
    await service.from("conversations").delete().eq("id", conversationId);
    return NextResponse.json({ error: "Impossible de créer le groupe." }, { status: 500 });
  }

  return NextResponse.json({ conversationId, titre });
}
