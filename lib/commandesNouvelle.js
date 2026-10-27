// Fonctions du formulaire de prise de commande (components/moi/CommandeEmployeModal.jsx)
// quand il est utilisé avec la session du dashboard (app gestionnaire, kiosque des commandes)
// plutôt qu'avec les routes de l'app employé. Côté navigateur (client Supabase).

import { supabase } from "@/lib/supabaseClient";
import { imprimerCommande, mettreAJourTachesCommandes } from "@/lib/commandesClient";
import { lireProduitsTries } from "@/lib/ordreProduits";

// Dans l'ordre choisi par glisser-déposer dans Inventaire > Produits (voir lib/ordreProduits.js), sinon alphabétique.
export async function chargerProduitsInventaire(entrepriseId) {
  return lireProduitsTries(
    (colonnes) => supabase.from("produits_inventaire").select(colonnes).eq("entreprise_id", entrepriseId).order("nom", { ascending: true }).limit(1000),
    "id, nom, sku, prix, source, source_id, categorie_id"
  );
}

// Catégories de l'inventaire (dans l'ordre choisi), pour le catalogue de la prise de commande sur tablette.
export async function chargerCategoriesInventaire(entrepriseId) {
  const { data } = await supabase
    .from("categories_inventaire")
    .select("id, nom, ordre")
    .eq("entreprise_id", entrepriseId)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  return data || [];
}

// Crée une commande saisie à la main : déjà "Traitée" (elle est écrite par un employé), numéro M1, M2...,
// total calculé ici, tâches "Réservations" mises à jour et bon imprimé si l'impression automatique est activée.
export async function creerCommandeManuelle(entrepriseId, c) {
  const { count } = await supabase
    .from("commandes_en_ligne")
    .select("id", { count: "exact", head: true })
    .eq("entreprise_id", entrepriseId)
    .eq("source", "manuel");
  const total = Math.round(c.items.reduce((somme, it) => somme + it.quantite * (it.prix || 0), 0) * 100) / 100;
  const id = crypto.randomUUID(); // pas de insert().select() : on garde l'id pour l'impression
  const maintenant = new Date().toISOString();
  const telephone = String(c.client_telephone || "").trim();

  const { error } = await supabase.from("commandes_en_ligne").insert({
    id,
    entreprise_id: entrepriseId,
    source: "manuel",
    canal: "MANUEL",
    source_id: crypto.randomUUID(),
    numero: `M${(count || 0) + 1}`,
    statut: "APPROVED",
    statut_paiement: c.paye ? "PAID" : "NOT_PAID",
    statut_preparation: "NOT_FULFILLED",
    etape: "traitee",
    mode: c.mode,
    client_nom: String(c.client_nom || "").trim() || null,
    ...(telephone ? { client_telephone: telephone } : {}),
    total,
    items: c.items,
    date_commande: maintenant,
    date_ramassage: c.date_ramassage,
    date_ramassage_fin: c.date_ramassage_fin || null,
    updated_at: maintenant,
  });
  if (error) return { ok: false, error: "Impossible d'enregistrer la commande." };

  // Info supplémentaire : écrite à part (la commande s'enregistre même si commandes_note.sql n'est pas exécuté).
  const note = String(c.note || "").trim().slice(0, 500);
  if (note) await supabase.from("commandes_en_ligne").update({ note }).eq("id", id);

  await imprimerCommande(entrepriseId, id, "creation");
  await mettreAJourTachesCommandes(entrepriseId);
  return { ok: true };
}

// Modifie une commande saisie à la main (même forme que creerCommandeManuelle). Les commandes du site ne sont pas modifiables ici.
export async function modifierCommandeManuelle(entrepriseId, commandeId, c) {
  const total = Math.round(c.items.reduce((somme, it) => somme + it.quantite * (it.prix || 0), 0) * 100) / 100;
  const telephone = String(c.client_telephone || "").trim();
  const { error } = await supabase
    .from("commandes_en_ligne")
    .update({
      client_nom: String(c.client_nom || "").trim() || null,
      client_telephone: telephone || null,
      mode: c.mode,
      statut_paiement: c.paye ? "PAID" : "NOT_PAID",
      total,
      items: c.items,
      date_ramassage: c.date_ramassage,
      date_ramassage_fin: c.date_ramassage_fin || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commandeId)
    .eq("entreprise_id", entrepriseId)
    .eq("source", "manuel");
  if (error) return { ok: false, error: "Impossible d’enregistrer la commande." };

  // Info supplémentaire : écrite à part (comme à la création).
  await supabase.from("commandes_en_ligne").update({ note: String(c.note || "").trim().slice(0, 500) || null }).eq("id", commandeId);

  await mettreAJourTachesCommandes(entrepriseId);
  return { ok: true };
}

// Retire (supprime) une commande saisie à la main.
export async function retirerCommandeManuelle(entrepriseId, commandeId) {
  const { error } = await supabase.from("commandes_en_ligne").delete().eq("id", commandeId).eq("entreprise_id", entrepriseId).eq("source", "manuel");
  if (error) return { ok: false, error: "Impossible de retirer la commande." };
  await mettreAJourTachesCommandes(entrepriseId);
  return { ok: true };
}
