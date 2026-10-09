// Échange de quart, complet ou PARTIEL (voir supabase/echange_partiel.sql). Partagé par la réponse de
// l'employé (service_role) et l'approbation du gestionnaire (client Supabase du navigateur) : les deux
// ont la même API de requêtes, donc le client est passé en paramètre.

const hm = (t) => String(t || "").slice(0, 5);

// Plage échangée d'une demande ("HH:MM"), ou null si c'est le quart au complet.
export function plageEchange(demande, quart) {
  const debut = hm(demande?.heure_debut);
  const fin = hm(demande?.heure_fin);
  if (!debut || !fin || !quart) return null;
  if (debut <= hm(quart.heure_debut) && fin >= hm(quart.heure_fin)) return null;
  return { debut, fin };
}

// Plage choisie par l'employé : null = valide, sinon le message d'erreur.
// Les quarts qui finissent après minuit ne se divisent pas (heures comparées sur une même journée).
export function erreurPlage(debut, fin, quart) {
  const ok = (h) => /^\d{2}:\d{2}$/.test(h || "");
  if (!ok(debut) || !ok(fin)) return "Heures invalides.";
  if (hm(quart.heure_fin) <= hm(quart.heure_debut)) return "Un quart qui finit après minuit s'échange au complet seulement.";
  if (debut >= fin) return "L'heure de fin doit être après l'heure de début.";
  if (debut < hm(quart.heure_debut) || fin > hm(quart.heure_fin)) return "Les heures doivent être comprises dans le quart.";
  return null;
}

// Ramène une heure "HH:MM" saisie dans les bornes du quart (vide reste vide).
export function dansLeQuart(valeur, quart) {
  if (!valeur) return valeur;
  const min = hm(quart.heure_debut);
  const max = hm(quart.heure_fin);
  return valeur < min ? min : valeur > max ? max : valeur;
}

// Met à jour un quart en y marquant l'échange (echange_de). Si la colonne n'existe pas encore
// (SQL pas exécuté), l'échange s'applique quand même, sans le libellé.
async function majQuart(client, id, champs, echangeDe) {
  if (echangeDe) {
    const { error } = await client.from("planning_quarts").update({ ...champs, echange_de: echangeDe }).eq("id", id);
    if (!error) return;
  }
  await client.from("planning_quarts").update(champs).eq("id", id);
}

async function ajouterQuarts(client, lignes) {
  const { error } = await client.from("planning_quarts").insert(lignes);
  if (error) {
    // Colonne echange_de absente : on réessaie sans.
    await client.from("planning_quarts").insert(lignes.map(({ echange_de, ...reste }) => reste));
  }
}

// Donne le quart (ou la plage) au receveur. Plage partielle : le quart est découpé en
// [avant : donneur] [plage : receveur] [après : donneur], les morceaux vides n'existent pas.
export async function appliquerEchangeQuart(client, demande) {
  const { data: q } = await client.from("planning_quarts").select("*").eq("id", demande.quart_id).maybeSingle();
  if (!q) return false;

  const plage = plageEchange(demande, q);
  if (!plage) {
    await majQuart(client, q.id, { employe_id: demande.employe_receveur_id }, demande.employe_donneur_id);
    return true;
  }

  // Le quart a pu changer depuis la demande : on reste à l'intérieur.
  const debut = plage.debut < hm(q.heure_debut) ? hm(q.heure_debut) : plage.debut;
  const fin = plage.fin > hm(q.heure_fin) ? hm(q.heure_fin) : plage.fin;
  if (debut >= fin) return false;

  // Le morceau du receveur porte echange_de ; ceux du donneur gardent ce que le quart avait déjà.
  const segments = [];
  if (debut > hm(q.heure_debut)) segments.push({ employe_id: demande.employe_donneur_id, heure_debut: q.heure_debut, heure_fin: debut });
  segments.push({ employe_id: demande.employe_receveur_id, heure_debut: debut, heure_fin: fin, echange_de: demande.employe_donneur_id });
  if (fin < hm(q.heure_fin)) segments.push({ employe_id: demande.employe_donneur_id, heure_debut: fin, heure_fin: q.heure_fin });

  const [premier, ...autres] = segments;
  const { echange_de: premierEchange, ...premierChamps } = premier;
  await majQuart(client, q.id, premierChamps, premierEchange);
  if (autres.length > 0) {
    const { id, created_at, ...copie } = q;
    await ajouterQuarts(client, autres.map((s) => ({ ...copie, ...s })));
  }
  return true;
}
