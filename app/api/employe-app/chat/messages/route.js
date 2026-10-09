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

// Messages qui portent une proposition d'échange de quart : on joint la demande (statut, quart)
// pour que la conversation affiche la carte avec Accepter / Refuser.
async function ajouterEchanges(service, messages, employeId) {
  const ids = [...new Set(messages.map((m) => m.demandeEchangeId).filter(Boolean))];
  if (ids.length === 0) return messages;

  const { data } = await service
    .from("demandes_echange")
    .select("id, employe_donneur_id, employe_receveur_id, statut_employe, statut_admin, planning_quarts(date, heure_debut, heure_fin)")
    .in("id", ids);
  const parId = new Map((data || []).map((d) => [d.id, d]));

  return messages.map((m) => {
    const d = m.demandeEchangeId && parId.get(m.demandeEchangeId);
    if (!d) return m;
    return {
      ...m,
      echange: {
        id: d.id,
        role: d.employe_donneur_id === employeId ? "donneur" : d.employe_receveur_id === employeId ? "receveur" : "autre",
        statutEmploye: d.statut_employe,
        statutAdmin: d.statut_admin,
        quart: d.planning_quarts,
      },
    };
  });
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
      demandeEchangeId: m.demande_echange_id || null,
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
  const resolus = await ajouterEchanges(service, await resoudreNoms(service, messages || [], employe.id), employe.id);

  const reactions = await reactionsDe(service, resolus.map((m) => m.id), `e:${employe.id}`);
  return NextResponse.json({ messages: resolus.map((m) => ({ ...m, reactions: reactions[m.id] || [] })) });
}

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { conversationId, contenu, reponseA, demandeEchangeId } = await request.json().catch(() => ({}));
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

  // Proposition d'échange : la demande doit être la mienne (je suis celui qui donne le quart).
  let echangeId = null;
  if (demandeEchangeId) {
    const { data } = await service
      .from("demandes_echange")
      .select("id, employe_donneur_id, entreprise_id")
      .eq("id", demandeEchangeId)
      .maybeSingle();
    if (data && data.employe_donneur_id === employe.id && data.entreprise_id === employe.entreprise_id) echangeId = data.id;
  }

  const base = { conversation_id: conversationId, employe_id: employe.id, contenu: contenu.trim() };
  if (echangeId) {
    // Si la colonne demande_echange_id n'existe pas encore (SQL pas exécuté), l'insertion échoue
    // et on retombe plus bas sur un simple message texte.
    const essai = await service
      .from("messages")
      .insert({ ...base, demande_echange_id: echangeId })
      .select("*")
      .single();
    if (!essai.error) {
      notifierNouveauMessage(service, {
        conversationId,
        expediteurNom: employe.nom,
        contenu: essai.data.contenu,
        exclureEmployeId: employe.id,
      }).catch((err) => console.error("Erreur notification push:", err));
      return NextResponse.json({
        message: { id: essai.data.id, contenu: essai.data.contenu, createdAt: essai.data.created_at, expediteurNom: employe.nom, deMoi: true, reponse: null, reactions: [] },
      });
    }
  }

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
