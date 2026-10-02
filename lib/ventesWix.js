// Import des ventes Wix (commandes en ligne + point de vente) dans le module
// Suivi des ventes. Côté serveur seulement (service_role).
//
// - Commandes en ligne : une ligne de vente PAR commande (source "wix").
// - Point de vente (POS) : une ligne par JOUR avec le total du comptoir
//   (source "wix_pos") - sinon des centaines de lignes noieraient le journal.
//
// On ne compte que les commandes payées et non annulées (remboursements
// déduits). Rejouable à volonté : les lignes sont mises à jour sur place
// (source_id) et celles qui ne sont plus valides (annulée, remboursée) sont
// retirées. Les ventes entrées à la main (source_id NULL) ne sont jamais touchées.

import { bornesJour, dateAujourdhui, decalerJour } from "@/lib/commandes";
import { obtenirCommandesWix } from "@/lib/wixClient";

function dateQuebec(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date(iso));
}

function arrondi(n) {
  return Math.round(n * 100) / 100;
}

function estVendue(c) {
  return c.statut !== "CANCELED" && ["PAID", "PARTIALLY_REFUNDED"].includes(c.statut_paiement);
}

// Total de la commande moins ce qui a été remboursé.
function montantNet(c) {
  const rembourse = parseFloat(c.brut?.balanceSummary?.refunded?.amount) || 0;
  return arrondi((Number(c.total) || 0) - rembourse);
}

// Retourne { enLigne, jours: nb de jours de point de vente, retirees }.
export async function synchroniserVentesWix(service, entrepriseId, instanceId, jours = 3) {
  const nbJours = Math.min(Math.max(Number(jours) || 3, 1), 90);
  const dateDebut = decalerJour(dateAujourdhui(), -(nbJours - 1));
  const depuis = bornesJour(dateDebut).debut;

  const [enLigne, pos] = await Promise.all([
    obtenirCommandesWix(instanceId, depuis, "en_ligne", 5),
    obtenirCommandesWix(instanceId, depuis, "pos", 40),
  ]);

  const lignes = [];

  for (const c of enLigne) {
    const montant = montantNet(c);
    if (!estVendue(c) || montant <= 0 || !c.source_id) continue;
    lignes.push({
      entreprise_id: entrepriseId,
      source: "wix",
      source_id: c.source_id,
      montant,
      date: dateQuebec(c.date_commande),
      description: `Commande en ligne #${c.numero || ""}`.trim(),
    });
  }

  const parJour = new Map();
  for (const c of pos) {
    if (!estVendue(c)) continue;
    const jour = dateQuebec(c.date_commande);
    const courant = parJour.get(jour) || { somme: 0, nombre: 0 };
    courant.somme += montantNet(c);
    courant.nombre += 1;
    parJour.set(jour, courant);
  }
  for (const [jour, { somme, nombre }] of parJour) {
    if (somme <= 0) continue;
    lignes.push({
      entreprise_id: entrepriseId,
      source: "wix_pos",
      source_id: `pos:${jour}`,
      montant: arrondi(somme),
      date: jour,
      description: `${nombre} vente${nombre > 1 ? "s" : ""} au comptoir`,
    });
  }

  if (lignes.length > 0) {
    const { error } = await service.from("ventes").upsert(lignes, { onConflict: "entreprise_id,source,source_id" });
    if (error) throw new Error(error.message);
  }

  // Retire les lignes importées de la période qui ne sont plus valides.
  const voulues = new Set(lignes.map((l) => `${l.source}|${l.source_id}`));
  const { data: existantes } = await service
    .from("ventes")
    .select("id, source, source_id")
    .eq("entreprise_id", entrepriseId)
    .in("source", ["wix", "wix_pos"])
    .not("source_id", "is", null)
    .gte("date", dateDebut);

  const aRetirer = (existantes || []).filter((v) => !voulues.has(`${v.source}|${v.source_id}`)).map((v) => v.id);
  if (aRetirer.length > 0) await service.from("ventes").delete().in("id", aRetirer);

  return { enLigne: lignes.filter((l) => l.source === "wix").length, jours: parJour.size, retirees: aRetirer.length };
}
