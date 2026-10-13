import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { getOrCreateDirecteConversation } from "@/lib/chatServer";
import { chargerRestrictions } from "@/lib/chatRestrictions";
import { notifierNouveauMessage } from "@/lib/pushServer";

// Envoie le même message à plusieurs collègues, SÉPARÉMENT : chacun le reçoit dans sa propre
// conversation directe avec l'expéditeur (aucun groupe n'est créé). Réservé aux employés autorisés
// par le propriétaire ; les personnes bloquées sont sautées sans qu'on dise lesquelles.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const corps = await request.json().catch(() => ({}));
  const contenu = typeof corps.contenu === "string" ? corps.contenu.trim().slice(0, 2000) : "";
  const ids = [...new Set(Array.isArray(corps.employeIds) ? corps.employeIds.map(String) : [])].filter((id) => id !== employe.id).slice(0, 50);

  if (!contenu) {
    return NextResponse.json({ error: "Écris un message." }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: "Choisis au moins une personne." }, { status: 400 });
  }

  const service = getServiceClient();
  const restrictions = await chargerRestrictions(service, employe.id);
  if (!restrictions.multi) {
    return NextResponse.json({ error: "L'envoi à plusieurs personnes n'est pas autorisé pour ton compte." }, { status: 403 });
  }

  // Tous les destinataires doivent être des employés de la même entreprise.
  const { data: collegues } = await service.from("employes").select("id").eq("entreprise_id", employe.entreprise_id).in("id", ids);
  if ((collegues || []).length !== ids.length) {
    return NextResponse.json({ error: "Collègue introuvable." }, { status: 404 });
  }

  let envoyes = 0;
  let refuses = 0;

  for (const id of ids) {
    if (restrictions.bloques.has(id)) {
      refuses++;
      continue;
    }
    try {
      const conversationId = await getOrCreateDirecteConversation(service, employe.entreprise_id, { employeId: employe.id }, { employeId: id });
      const { error } = await service.from("messages").insert({ conversation_id: conversationId, employe_id: employe.id, contenu });
      if (error) throw error;
      envoyes++;
      notifierNouveauMessage(service, {
        conversationId,
        expediteurNom: employe.nom,
        contenu,
        exclureEmployeId: employe.id,
      }).catch((err) => console.error("Erreur notification push:", err));
    } catch (err) {
      console.error("Erreur envoi à plusieurs:", err?.message || err);
      refuses++;
    }
  }

  if (envoyes === 0) {
    return NextResponse.json({ error: "Impossible d'écrire à ces personnes.", envoyes, refuses }, { status: 403 });
  }
  return NextResponse.json({ ok: true, envoyes, refuses });
}
