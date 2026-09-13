import webpush from "web-push";

// Envoi de notifications push web aux employés (app /moi). Voir
// employe_push_subscriptions.sql pour la table, et public/sw-push.js pour
// le service worker qui affiche la notification côté navigateur.

let configure = true;

function ensureConfigured() {
  if (!configure) return;
  configure = false;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return;

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

// Envoie une notification à un ou plusieurs employés (par id) - échoue en
// silence par employé (un appareil hors ligne ne doit jamais faire planter
// l'envoi du message lui-même). Les abonnements qui répondent 404/410
// (navigateur désinstallé, permission retirée) sont supprimés au passage.
export async function envoyerPushEmployes(service, employeIds, { titre, corps, url }) {
  ensureConfigured();
  if (!process.env.VAPID_PRIVATE_KEY || employeIds.length === 0) return;

  const { data: abonnements } = await service
    .from("employe_push_subscriptions")
    .select("id, employe_id, endpoint, p256dh, auth")
    .in("employe_id", employeIds);

  console.log("[push-debug] employeIds:", employeIds, "abonnements trouvés:", abonnements?.length ?? 0);

  if (!abonnements || abonnements.length === 0) return;

  const payload = JSON.stringify({ titre, corps, url });

  await Promise.all(
    abonnements.map(async (abo) => {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          payload
        );
        console.log("[push-debug] envoi reussi vers abonnement", abo.id);
      } catch (err) {
        console.error("[push-debug] echec envoi vers abonnement", abo.id, "statusCode:", err?.statusCode, "body:", err?.body);
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await service.from("employe_push_subscriptions").delete().eq("id", abo.id);
        } else {
          console.error("Erreur envoi push employé:", err?.message || err);
        }
      }
    })
  );
}

// Détermine qui doit recevoir une notif pour un nouveau message (les
// employés de la conversation, sauf l'expéditeur si lui-même employé) et
// l'envoie. Appelé depuis les deux points d'entrée de la messagerie :
// POST /api/employe-app/chat/messages (employé) et POST /api/notifications/chat
// (dashboard, où l'envoi se fait client-side via RLS donc web-push, qui a
// besoin de Node, ne peut pas tourner directement dans ce composant).
export async function notifierNouveauMessage(service, { conversationId, expediteurNom, contenu, exclureEmployeId }) {
  const { data: conversation } = await service
    .from("conversations")
    .select("id, type, entreprise_id")
    .eq("id", conversationId)
    .maybeSingle();
  console.log("[push-debug] conversation:", conversation);
  if (!conversation) return;

  let employeIds = [];
  if (conversation.type === "equipe") {
    const { data: employes } = await service.from("employes").select("id").eq("entreprise_id", conversation.entreprise_id);
    employeIds = (employes || []).map((e) => e.id);
  } else {
    const { data: participants } = await service
      .from("conversation_participants")
      .select("employe_id")
      .eq("conversation_id", conversationId)
      .not("employe_id", "is", null);
    console.log("[push-debug] participants directe:", participants);
    employeIds = (participants || []).map((p) => p.employe_id);
  }

  employeIds = employeIds.filter((id) => id && id !== exclureEmployeId);
  console.log("[push-debug] employeIds apres filtre (exclure=" + exclureEmployeId + "):", employeIds);
  if (employeIds.length === 0) return;

  await envoyerPushEmployes(service, employeIds, {
    titre: expediteurNom,
    corps: contenu.length > 120 ? contenu.slice(0, 117) + "..." : contenu,
    url: "/moi/discussion",
  });
}
