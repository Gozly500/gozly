import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

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

  return messages.map((m) => ({
    id: m.id,
    contenu: m.contenu,
    createdAt: m.created_at,
    expediteurNom: expediteurNom(m),
    deMoi: m.employe_id === employeIdCourant,
  }));
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

  return NextResponse.json({ messages: resolus });
}

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { conversationId, contenu } = await request.json().catch(() => ({}));
  if (!conversationId || !contenu?.trim()) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!(await aAcces(service, employe, conversationId))) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const { data: message, error } = await service
    .from("messages")
    .insert({ conversation_id: conversationId, employe_id: employe.id, contenu: contenu.trim() })
    .select("*")
    .single();

  if (error) {
    console.error("Erreur envoi message employé:", error);
    return NextResponse.json({ error: "L'envoi a échoué." }, { status: 500 });
  }

  return NextResponse.json({
    message: { id: message.id, contenu: message.contenu, createdAt: message.created_at, expediteurNom: employe.nom, deMoi: true },
  });
}
