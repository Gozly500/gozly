// Tâches automatiques à partir des commandes en ligne : une tâche par
// produit et par jour avec le total à préparer ("Pizza au tomate × 6"), dans
// la catégorie "Réservations". Côté serveur seulement (service_role).
//
// Recalculé à chaque synchro Wix et à chaque ajout/modification/retrait d'une
// commande manuelle : on compare ce qu'il FAUT avoir (les commandes) à ce qui
// existe, et on ajoute / met à jour / retire seulement les tâches marquées
// source = 'commande' - jamais celles créées par l'équipe.

import { dateAujourdhui, decalerJour, bornesJour, NOM_CATEGORIE_COMMANDES, ANCIEN_NOM_CATEGORIE_COMMANDES } from "@/lib/commandes";

export { NOM_CATEGORIE_COMMANDES };
const JOURS_A_VENIR = 60;

function dateQuebec(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date(iso));
}

function normaliser(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Quelle(s) succursale(s) doit préparer cette commande ?
// - aucune succursale dans Gozly : pas de filtre (null) ;
// - une seule : celle-là ;
// - plusieurs : celle dont le nom correspond au lieu de la commande, sinon
//   toutes (pour que personne ne rate une commande dont le lieu est inconnu).
function emplacementsPour(commande, emplacements) {
  if (emplacements.length === 0) return [null];
  if (emplacements.length === 1) return [emplacements[0].id];
  const lieu = normaliser(commande.lieu_nom);
  if (lieu) {
    const trouve = emplacements.find((e) => {
      const nom = normaliser(e.nom);
      return nom && (lieu.includes(nom) || nom.includes(lieu));
    });
    if (trouve) return [trouve.id];
  }
  return emplacements.map((e) => e.id);
}

async function trouverOuCreerCategorie(service, entrepriseId) {
  const { data: existante } = await service
    .from("categories")
    .select("id")
    .eq("entreprise_id", entrepriseId)
    .eq("nom", NOM_CATEGORIE_COMMANDES)
    .limit(1)
    .maybeSingle();
  if (existante) return existante.id;

  // Catégorie créée sous l'ancien nom : on la renomme plutôt que d'en créer une deuxième.
  const { data: ancienne } = await service
    .from("categories")
    .select("id")
    .eq("entreprise_id", entrepriseId)
    .eq("nom", ANCIEN_NOM_CATEGORIE_COMMANDES)
    .limit(1)
    .maybeSingle();
  if (ancienne) {
    await service.from("categories").update({ nom: NOM_CATEGORIE_COMMANDES }).eq("id", ancienne.id);
    return ancienne.id;
  }

  const { data: creee } = await service
    .from("categories")
    .insert({ entreprise_id: entrepriseId, nom: NOM_CATEGORIE_COMMANDES })
    .select("id")
    .single();
  return creee?.id || null;
}

// Quand les tâches automatiques sont désactivées (interrupteur ou module
// Commandes retiré) : retire toutes les tâches qu'elles avaient créées, puis la
// catégorie "Réservations" elle-même si plus aucune tâche ne l'utilise, pour
// qu'elle ne s'affiche plus nulle part. (Si l'équipe y a ajouté ses propres
// tâches, la catégorie reste pour ne pas les laisser sans catégorie.)
export async function retirerTachesCommandes(service, entrepriseId) {
  await service.from("taches").delete().eq("entreprise_id", entrepriseId).eq("source", "commande");

  const { data: categorie } = await service
    .from("categories")
    .select("id")
    .eq("entreprise_id", entrepriseId)
    .eq("nom", NOM_CATEGORIE_COMMANDES)
    .limit(1)
    .maybeSingle();
  if (!categorie) return;

  const { count } = await service
    .from("taches")
    .select("id", { count: "exact", head: true })
    .eq("categorie_id", categorie.id);
  if (!count) await service.from("categories").delete().eq("id", categorie.id);
}

// Retourne { crees, misesAJour, retirees } (ou null si rien à faire).
export async function synchroniserTachesCommandes(service, entrepriseId) {
  const { data: entreprise, error: erreurEntreprise } = await service
    .from("entreprises")
    .select("commandes_vers_taches")
    .eq("id", entrepriseId)
    .maybeSingle();
  if (erreurEntreprise || !entreprise) return null;

  const { data: modules } = await service.from("modules_actifs").select("module").eq("entreprise_id", entrepriseId);
  const modulesActifs = (modules || []).map((m) => m.module);

  // Désactivé (interrupteur, ou module Commandes retiré) : plus de tâches ni de catégorie.
  if (entreprise.commandes_vers_taches === false || !modulesActifs.includes("commandes")) {
    await retirerTachesCommandes(service, entrepriseId);
    return null;
  }
  if (!modulesActifs.includes("planning")) return null;

  // Fenêtre : d'hier jusqu'à dans 60 jours (le passé lointain ne bouge plus).
  const aujourdhui = dateAujourdhui();
  const dateDebut = decalerJour(aujourdhui, -1);
  const dateFin = decalerJour(aujourdhui, JOURS_A_VENIR);
  const debut = bornesJour(dateDebut).debut;
  const fin = bornesJour(dateFin).fin;

  const [{ data: commandes }, { data: emplacementsData }, { data: existantes }] = await Promise.all([
    service
      .from("commandes_en_ligne")
      .select("statut, items, lieu_nom, date_commande, date_ramassage")
      .eq("entreprise_id", entrepriseId)
      .neq("canal", "POS") // une vente au comptoir est déjà servie : pas de tâche de préparation
      .or(
        `and(date_ramassage.gte.${debut},date_ramassage.lt.${fin}),and(date_ramassage.is.null,date_commande.gte.${debut},date_commande.lt.${fin})`
      ),
    service.from("emplacements").select("id, nom").eq("entreprise_id", entrepriseId),
    service
      .from("taches")
      .select("id, date, emplacement_id, source_cle, source_qte, terminee, texte, categorie_id")
      .eq("entreprise_id", entrepriseId)
      .eq("source", "commande")
      .gte("date", dateDebut)
      .lte("date", dateFin),
  ]);

  const emplacements = emplacementsData || [];

  // 1. Ce qu'il faut : total par (succursale, jour, produit + options).
  const voulues = new Map();
  for (const commande of commandes || []) {
    if (commande.statut === "CANCELED") continue;
    const jour = dateQuebec(commande.date_ramassage || commande.date_commande);
    for (const emplacementId of emplacementsPour(commande, emplacements)) {
      for (const it of commande.items || []) {
        const options = (it.options || []).join(", ");
        // Clé = nom + valeurs d'options ("Taille: Grande" et "Grande" regroupent pareil), pour
        // que les commandes manuelles (depuis l'inventaire) et Wix s'additionnent.
        const valeursOptions = (it.options || []).map((o) => String(o).split(": ").pop()).join(", ");
        const cleProduit = `${normaliser(it.nom)}|${normaliser(valeursOptions)}`;
        const cle = `${emplacementId || ""}|${jour}|${cleProduit}`;
        const nom = options ? `${it.nom} (${options})` : it.nom;
        const courante = voulues.get(cle) || { emplacementId, jour, cleProduit, nom, quantite: 0 };
        courante.quantite += Number(it.quantite) || 0;
        voulues.set(cle, courante);
      }
    }
  }

  const categorieId = voulues.size > 0 || (existantes || []).length > 0 ? await trouverOuCreerCategorie(service, entrepriseId) : null;

  // 2. Ce qui existe déjà, retrouvé par la même clé.
  const parCle = new Map();
  for (const t of existantes || []) parCle.set(`${t.emplacement_id || ""}|${t.date}|${t.source_cle}`, t);

  const aCreer = [];
  let misesAJour = 0;

  for (const [cle, v] of voulues) {
    const texte = `${v.nom} × ${v.quantite}`;
    const existante = parCle.get(cle);

    if (!existante) {
      aCreer.push({
        entreprise_id: entrepriseId,
        categorie_id: categorieId,
        date: v.jour,
        texte,
        terminee: false,
        emplacement_id: v.emplacementId,
        source: "commande",
        source_cle: v.cleProduit,
        source_qte: v.quantite,
      });
      continue;
    }

    parCle.delete(cle); // traitée : ce qui reste dans parCle est à retirer

    const quantiteChangee = existante.source_qte !== v.quantite;
    if (quantiteChangee || existante.texte !== texte || existante.categorie_id !== categorieId) {
      await service
        .from("taches")
        .update({
          texte,
          source_qte: v.quantite,
          categorie_id: categorieId,
          // Une commande de plus pour un produit déjà "préparé" : il y a
          // encore à faire, donc la tâche redevient à faire.
          ...(quantiteChangee && v.quantite > (existante.source_qte || 0) ? { terminee: false } : {}),
        })
        .eq("id", existante.id);
      misesAJour++;
    }
  }

  if (aCreer.length > 0) await service.from("taches").insert(aCreer);

  // 3. Tâches dont il n'y a plus de commande (annulée, retirée, date changée).
  const aRetirer = [...parCle.values()].map((t) => t.id);
  if (aRetirer.length > 0) await service.from("taches").delete().in("id", aRetirer);

  return { crees: aCreer.length, misesAJour, retirees: aRetirer.length };
}
