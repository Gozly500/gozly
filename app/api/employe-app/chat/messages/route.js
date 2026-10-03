import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { notifierNouveauMessage } from "@/lib/pushServer";
import { reactionsDe } from "@/lib/chatReactions";

async function aAcces(service, employe, conversationId) {
  const { data: conversation } = await service
    .from("conversations")
    .select("id, type, entreprise_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation || conversation.entreprise_id !== employe.entreprise_id) return false;
  if (conversation.type === "equipe") return true;

  const { data: participation } = await service
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("employe_id", employe.id)
    .maybeSingle();

  return !!participation;
}

async function resoudreNoms(service, messages, employeIdCourant) {
  const employeIds = [...new Set(messages.filter((m) => m.employe_id).map((m) => m.employe_id))];
  const userIds = [...new Set(messages.filter((m) => m.user_id).map((m) => m.user_id))];

  const [{ data: employes }, { data: profils }] = await Promise.all([
    employeIds.length > 0 ? service.from("employes").select("id, nom").in("id", employeIds) : Promise.resolve({ data: [] }),
    userIds.length > 0 ? service.from("profils").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] }),
  ]);

  function expediteurNom(m) {
    if (m.employe_id) return employes?.find((e) => e.id === m.employe_id)?.nom || "Employé";
    if (m.user_id) return profils?.find((p) => p.id === m.user_id)?.full_name || "Administration";
    return "Compte supprimé";
  }

  const parId = new Map(messages.map((m) => [m.id, m]));
  return messages.map((m) => {
    const parent = m.reponse_a ? parId.get(m.reponse_a) : null;
    return {
      id: m.id,
      contenu: m.contenu,
      createdAt: m.created_at,
      expediteurNom: expediteurNom(m),
      deMoi: m.employe_id === employeIdCourant,
      reponse: parent
        ? { auteur: expediteurNom(parent), deMoi: parent.employe_id === employeIdCourant, contenu: String(parent.contenu).slice(0, 140) }
        : null,
    };
  });
}

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  const apres = searchParams.get("apres");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId manquant." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!(await aAcces(service, employe, conversationId))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  let query = service.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  if (apres) query = query.gt("created_at", apres);

  const { data: messages } = await query;
  const resolus = await resoudreNoms(service, messages || [], employe.id);

  const reactions = await reactionsDe(service, resolus.map((m) => m.id), `e:${employe.id}`);
  return NextResponse.json({ messages: resolus.map((m) => ({ ...m, reactions: reactions[m.id] || [] })) });
}

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { conversationId, contenu, reponseA } = await request.json().catch(() => ({}));
  if (!conversationId || !contenu?.trim()) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!(await aAcces(service, employe, conversationId))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  // Réponse à un message précis : il doit être dans la même conversation.
  let parent = null;
  if (reponseA) {
    const { data } = await service.from("messages").select("*").eq("id", reponseA).eq("conversation_id", conversationId).maybeSingle();
    parent = data || null;
  }

  const base = { conversation_id: conversationId, employe_id: employe.id, contenu: contenu.trim() };
  let { data: message, error } = await service
    .from("messages")
    .insert(parent ? { ...base, reponse_a: parent.id } : base)
    .select("*")
    .single();
  // Colonne reponse_a pas encore créée (SQL pas exécuté) : on envoie sans la citation.
  if (error && parent) {
    parent = null;
    ({ data: message, error } = await service.from("messages").insert(base).select("*").single());
  }

  if (error) {
    console.error("Erreur envoi message employé:", error);
    return NextResponse.json({ error: "L'envoi a échoué." }, { status: 500 });
  }

  notifierNouveauMessage(service, {
    conversationId,
    expediteurNom: employe.nom,
    contenu: message.contenu,
    exclureEmployeId: employe.id,
  }).catch((err) => console.error("Erreur notification push:", err));

  let reponse = null;
  if (parent) {
    const [p] = await resoudreNoms(service, [parent], employe.id);
    reponse = { auteur: p.expediteurNom, deMoi: p.deMoi, contenu: String(parent.contenu).slice(0, 140) };
  }

  return NextResponse.json({
    message: { id: message.id, contenu: message.contenu, createdAt: message.created_at, expediteurNom: employe.nom, deMoi: true, reponse, reactions: [] },
  });
}
