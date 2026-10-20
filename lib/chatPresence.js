// "En train d'écrire" et "Vu" de la discussion (table chat_presence).
// Côté serveur seulement (service_role). Appelé par /api/chat/presence
// (dashboard) et /api/employe-app/chat/presence (employés).

const FENETRE_ECRITURE_MS = 15000;

import { employesAvecAvatar, profilsAvecAvatar } from "@/lib/avatarServeur";

// avecAvatars : ajoute `ecriventAvatars` (même ordre que `ecrivent`) pour afficher l'avatar à côté du « écrit... ».
// ecrit : true (je tape) / false (j'ai arrêté) / undefined (rien) ; lu : true = je regarde la conversation.
// Retourne qui écrit en ce moment et qui a vu quoi (sans moi). Si la table n'existe pas
// encore (SQL pas exécuté), retourne simplement des listes vides.
export async function majEtLirePresence(service, { conversationId, maCle, monNom, ecrit, lu, avecAvatars = false }) {
  const maintenant = new Date().toISOString();

  if (ecrit !== undefined || lu) {
    const ligne = { conversation_id: conversationId, participant: maCle, nom: monNom || "" };
    if (ecrit === true) ligne.ecrit_at = maintenant;
    if (ecrit === false) ligne.ecrit_at = null;
    if (lu) ligne.lu_at = maintenant;
    await service.from("chat_presence").upsert(ligne, { onConflict: "conversation_id,participant" });
  }

  const { data, error } = await service
    .from("chat_presence")
    .select("participant, nom, ecrit_at, lu_at")
    .eq("conversation_id", conversationId);
  if (error) return { ecrivent: [], vus: [] };

  const autres = (data || []).filter((p) => p.participant !== maCle);
  const limite = Date.now() - FENETRE_ECRITURE_MS;
  const ceuxQuiEcrivent = autres.filter((p) => p.ecrit_at && new Date(p.ecrit_at).getTime() > limite);
  const resultat = {
    ecrivent: ceuxQuiEcrivent.map((p) => p.nom || "?"),
    vus: autres.filter((p) => p.lu_at).map((p) => ({ nom: p.nom || "?", luAt: p.lu_at })),
  };

  if (avecAvatars && ceuxQuiEcrivent.length > 0) {
    const ids = (prefixe) => ceuxQuiEcrivent.filter((p) => p.participant.startsWith(prefixe)).map((p) => p.participant.slice(prefixe.length));
    const [employes, profils] = await Promise.all([employesAvecAvatar(service, ids("e:")), profilsAvecAvatar(service, ids("u:"))]);
    resultat.ecriventAvatars = ceuxQuiEcrivent.map((p) => {
      const id = p.participant.slice(2);
      return (p.participant.startsWith("e:") ? employes.find((e) => e.id === id) : profils.find((x) => x.id === id))?.avatar || null;
    });
  }
  return resultat;
}
