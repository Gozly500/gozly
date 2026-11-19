// Ventes Wix (commandes en ligne + point de vente) pour le module Suivi des ventes. Côté serveur seulement.
//
// Rien n'est copié transaction par transaction : on LIT une journée chez Wix à la demande (page « journée »)
// et, à l'import, on garde seulement un RÉSUMÉ de la journée dans `ventes_jours` (totaux par mode de paiement,
// taxes, remboursements, nombre de ventes) - de quoi concilier avec un rapport Moneris ou un dépôt bancaire.
//
// On ne compte que les commandes payées et non annulées (remboursements déduits).

import { bornesJour } from "@/lib/commandes";
import { obtenirCommandesWix, obtenirPaiementsWixEnLot } from "@/lib/wixClient";
import { correspondAuLieu } from "@/lib/wixLieu";

function arrondi(n) {
  return Math.round(n * 100) / 100;
}

function estVendue(c) {
  return c.statut !== "CANCELED" && ["PAID", "PARTIALLY_REFUNDED"].includes(c.statut_paiement);
}

// Total de la commande moins ce qui a été remboursé.
function montantNet(c) {
  return arrondi((Number(c.total) || 0) - remboursementDe(c));
}

function remboursementDe(c) {
  return parseFloat(c.brut?.balanceSummary?.refunded?.amount) || 0;
}

// Pourboire, quand Wix le donne (selon le type de commande) ; 0 sinon.
function pourboireDe(c) {
  const brut = c.brut || {};
  return parseFloat(brut.tipSummary?.totalTip?.amount ?? brut.priceSummary?.tip?.amount ?? 0) || 0;
}

const LIBELLE_STATUT = {
  PAID: "Payée",
  PARTIALLY_REFUNDED: "Remboursée en partie",
  REFUNDED: "Remboursée",
  NOT_PAID: "Non payée",
  PENDING: "En attente",
  FULLY_REFUNDED: "Remboursée",
};

// Répartit le montant net d'une commande entre ses modes de paiement (au prorata des paiements).
function repartir(net, paiements) {
  if (!paiements || paiements.length === 0) return [{ methode: "Non précisé", montant: net }];
  const total = paiements.reduce((s, p) => s + p.montant, 0);
  if (paiements.length === 1 || total <= 0) return [{ methode: paiements[0].methode, montant: net }];
  return paiements.map((p) => ({ methode: p.methode, montant: arrondi((net * p.montant) / total) }));
}

// Toutes les ventes d'une journée (heure du Québec), lues chez Wix. Retourne { transactions, resume }.
// transactions : [{ id, numero, canal: "en_ligne" | "comptoir", heure, total, brut, taxes, pourboire, rembourse, methode, statut, comptee }],
// de la plus récente à la plus ancienne. resume : la ligne de `ventes_jours` (sans id ni conciliation).
export async function lireJourneeWix(instanceId, date, lieuFiltre = null) {
  const { debut, fin } = bornesJour(date);

  const [enLigneTout, posTout] = await Promise.all([
    obtenirCommandesWix(instanceId, debut, "en_ligne", 10, fin),
    obtenirCommandesWix(instanceId, debut, "pos", 60, fin),
  ]);

  // Plusieurs dashboards sur le même site Wix (une succursale chacun) : on ne compte que la succursale choisie.
  const enLigne = enLigneTout.filter((c) => correspondAuLieu(c, lieuFiltre, { inclureSansLieu: false }));
  const pos = posTout.filter((c) => correspondAuLieu(c, lieuFiltre, { inclureSansLieu: false }));
  const toutes = [...enLigne.map((c) => ({ c, canal: "en_ligne" })), ...pos.map((c) => ({ c, canal: "comptoir" }))];

  const paiements = await obtenirPaiementsWixEnLot(
    instanceId,
    toutes.filter(({ c }) => estVendue(c) && c.source_id).map(({ c }) => c.source_id)
  );

  const resume = {
    nb_en_ligne: 0,
    nb_comptoir: 0,
    total_en_ligne: 0,
    total_comptoir: 0,
    taxes: 0,
    pourboires: 0,
    remboursements: 0,
    par_paiement: {},
  };

  const transactions = toutes.map(({ c, canal }) => {
    const comptee = estVendue(c);
    const net = montantNet(c);
    const infos = paiements[c.source_id];
    const parts = comptee ? repartir(net, infos?.paiements) : [];
    const methode = infos?.paiements?.length ? [...new Set(infos.paiements.map((p) => p.methode))].join(" + ") : comptee ? "Non précisé" : "";

    if (comptee && net > 0) {
      if (canal === "en_ligne") {
        resume.nb_en_ligne += 1;
        resume.total_en_ligne += net;
      } else {
        resume.nb_comptoir += 1;
        resume.total_comptoir += net;
      }
      resume.taxes += Number(c.taxes) || 0;
      resume.pourboires += pourboireDe(c);
      resume.remboursements += remboursementDe(c);
      for (const p of parts) resume.par_paiement[p.methode] = arrondi((resume.par_paiement[p.methode] || 0) + p.montant);
    }

    return {
      id: c.source_id,
      numero: c.numero || "",
      canal,
      heure: c.date_commande,
      total: net,
      brut: Number(c.total) || 0,
      taxes: Number(c.taxes) || 0,
      pourboire: pourboireDe(c),
      rembourse: remboursementDe(c),
      methode,
      statut: c.statut === "CANCELED" ? "Annulée" : LIBELLE_STATUT[c.statut_paiement] || c.statut_paiement || "",
      comptee: comptee && net > 0,
    };
  });

  transactions.sort((a, b) => String(b.heure).localeCompare(String(a.heure)));
  for (const k of ["total_en_ligne", "total_comptoir", "taxes", "pourboires", "remboursements"]) resume[k] = arrondi(resume[k]);
  return { transactions, resume };
}

// Importe une journée : lit chez Wix, garde le RÉSUMÉ seulement. Réimporter la même journée met le résumé à jour
// sans toucher au total Moneris saisi ni à l'état « conciliée ».
export async function importerJourneeWix(service, entrepriseId, instanceId, date, lieuFiltre = null) {
  const { resume } = await lireJourneeWix(instanceId, date, lieuFiltre);
  const ligne = { entreprise_id: entrepriseId, date, source: "wix", ...resume, importe_le: new Date().toISOString() };
  const { data, error } = await service.from("ventes_jours").upsert(ligne, { onConflict: "entreprise_id,date,source" }).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data || ligne;
}
