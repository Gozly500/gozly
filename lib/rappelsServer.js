// Création d'un rappel (voir supabase/rappels.sql), partagée par la route du propriétaire (/api/rappels)
// et celle des employés (/api/employe-app/rappels). Côté serveur (service_role).

import { envoyerPushEmployes } from "@/lib/pushServer";
import { DUREES_RAPPEL_HEURES } from "@/lib/rappels";

const MAX_CARACTERES = 400;
const MAX_DESTINATAIRES = 50;

// auteur : { employeId?, userId?, nom } ; bloques : Set d'employés avec qui l'auteur ne peut pas communiquer.
// Retourne { rappel } ou { erreur, statut }.
export async function creerRappel(service, { entrepriseId, contenu, dureeHeures, pourTous, employeIds, auteur, bloques = new Set() }) {
  const texte = typeof contenu === "string" ? contenu.trim().slice(0, MAX_CARACTERES) : "";
  if (!texte) return { erreur: "Écris le texte du rappel.", statut: 400 };
  if (!DUREES_RAPPEL_HEURES.includes(Number(dureeHeures))) return { erreur: "Durée invalide.", statut: 400 };

  const { data: employes } = await service.from("employes").select("id").eq("entreprise_id", entrepriseId);
  const tousIds = (employes || []).map((e) => e.id);

  let cibles; // employés qui verront le rappel
  let pourTousFinal = !!pourTous;

  if (pourTous) {
    if (bloques.size > 0) {
      // L'auteur a des communications coupées : « tout le monde » exclut ces personnes (elles ne verront pas son rappel).
      pourTousFinal = false;
      cibles = tousIds.filter((id) => id !== auteur.employeId && !bloques.has(id));
    } else {
      cibles = tousIds.filter((id) => id !== auteur.employeId);
    }
  } else {
    const ids = [...new Set(Array.isArray(employeIds) ? employeIds.map(String) : [])].filter((id) => id !== auteur.employeId).slice(0, MAX_DESTINATAIRES);
    if (ids.length === 0) return { erreur: "Choisis au moins une personne.", statut: 400 };
    if (!ids.every((id) => tousIds.includes(id))) return { erreur: "Collègue introuvable.", statut: 404 };
    cibles = ids.filter((id) => !bloques.has(id));
  }

  if (cibles.length === 0) return { erreur: "Impossible de créer ce rappel pour ces personnes.", statut: 403 };

  const debut = new Date();
  const fin = new Date(debut.getTime() + Number(dureeHeures) * 3600 * 1000);

  const { data: rappel, error } = await service
    .from("rappels")
    .insert({
      entreprise_id: entrepriseId,
      contenu: texte,
      debut: debut.toISOString(),
      fin: fin.toISOString(),
      auteur_nom: auteur.nom || "Direction",
      cree_par_employe: auteur.employeId || null,
      cree_par_user: auteur.userId || null,
      pour_tous: pourTousFinal,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erreur création d'un rappel:", error.message);
    return { erreur: "La création a échoué (le fichier SQL rappels.sql est-il exécuté ?).", statut: 500 };
  }

  if (!pourTousFinal) {
    const { error: erreurDest } = await service.from("rappel_destinataires").insert(cibles.map((employe_id) => ({ rappel_id: rappel.id, employe_id })));
    if (erreurDest) {
      console.error("Erreur destinataires du rappel:", erreurDest.message);
      await service.from("rappels").delete().eq("id", rappel.id);
      return { erreur: "La création a échoué.", statut: 500 };
    }
  }

  // Notification aux destinataires (en silence si ça échoue : le rappel est créé dans tous les cas).
  await envoyerPushEmployes(service, cibles, {
    titre: "Rappel",
    corps: `${rappel.auteur_nom} : ${texte.length > 120 ? `${texte.slice(0, 117)}...` : texte}`,
    url: "/moi/accueil",
  }).catch((err) => console.error("Erreur notification de rappel:", err));

  return { rappel, nbDestinataires: cibles.length };
}
