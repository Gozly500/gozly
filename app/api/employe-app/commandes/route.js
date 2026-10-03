import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { aujourdhuiLocal } from "@/lib/dates";
import { bornesJour } from "@/lib/commandes";
import { synchroniserTachesCommandes } from "@/lib/tachesCommandes";
import { imprimerAutomatiquement } from "@/lib/impressionCommandes";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Réservations / commandes en ligne d'une journée, en lecture seule, pour que
// les employés planifient leur journée (et les suivantes, en changeant de jour).
// Seulement si le module Commandes en ligne est actif ; les ventes du point de
// vente (POS) et les commandes annulées n'y figurent pas.
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();

  const { data: module } = await service
    .from("modules_actifs")
    .select("module")
    .eq("entreprise_id", employe.entreprise_id)
    .eq("module", "commandes")
    .maybeSingle();
  if (!module) {
    return NextResponse.json({ commandes: [] });
  }

  const dateParam = new URL(request.url).searchParams.get("date");
  const date = dateParam && DATE_REGEX.test(dateParam) ? dateParam : aujourdhuiLocal();
  const { debut, fin } = bornesJour(date);

  const { data: commandes } = await service
    .from("commandes_en_ligne")
    .select("id, numero, client_nom, mode, lieu_nom, items, total, statut, statut_paiement, statut_preparation, etape, date_commande, date_ramassage, date_ramassage_fin")
    .eq("entreprise_id", employe.entreprise_id)
    .neq("canal", "POS")
    .neq("statut", "CANCELED")
    .or(
      `and(date_ramassage.gte.${debut},date_ramassage.lt.${fin}),and(date_ramassage.is.null,date_commande.gte.${debut},date_commande.lt.${fin})`
    );

  // Ordre chronologique du ramassage (ou de la commande s'il n'y a pas de ramassage).
  const triees = (commandes || []).sort(
    (a, b) => new Date(a.date_ramassage || a.date_commande) - new Date(b.date_ramassage || b.date_commande)
  );

  return NextResponse.json({ commandes: triees });
}

// Crée une commande / réservation à la main (téléphone, comptoir...) depuis
// l'app employé. Mêmes règles que le formulaire du dashboard : source "manuel",
// numéro M1, M2..., total recalculé ICI à partir des articles (on ne fait pas
// confiance au total envoyé par le téléphone).
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const corps = await request.json().catch(() => ({}));

  const articles = (Array.isArray(corps.items) ? corps.items : [])
    .slice(0, 60)
    .map((it) => {
      const prix = parseFloat(String(it?.prix ?? "").replace(",", "."));
      return {
        nom: String(it?.nom || "").trim().slice(0, 200),
        quantite: parseInt(it?.quantite, 10) || 0,
        prix: Number.isFinite(prix) && prix >= 0 ? prix : null,
        produit_id: it?.produit_id ? String(it.produit_id).slice(0, 100) : null,
        sku: it?.sku ? String(it.sku).slice(0, 100) : null,
        options: (Array.isArray(it?.options) ? it.options : []).map((o) => String(o).slice(0, 120)).slice(0, 10),
      };
    })
    .filter((it) => it.nom && it.quantite > 0 && it.quantite <= 999);

  if (articles.length === 0) {
    return NextResponse.json({ error: "Ajoute au moins un article." }, { status: 400 });
  }

  const mode = corps.mode === "livraison" ? "livraison" : "ramassage";
  let dateRamassage = null;
  if (corps.date_ramassage) {
    const ms = Date.parse(corps.date_ramassage);
    if (Number.isNaN(ms)) {
      return NextResponse.json({ error: "Date invalide." }, { status: 400 });
    }
    dateRamassage = new Date(ms).toISOString();
  }

  const service = getServiceClient();

  const { data: module } = await service
    .from("modules_actifs")
    .select("module")
    .eq("entreprise_id", employe.entreprise_id)
    .eq("module", "commandes")
    .maybeSingle();
  if (!module) {
    return NextResponse.json({ error: "Module non actif." }, { status: 403 });
  }

  const total = Math.round(articles.reduce((somme, it) => somme + it.quantite * (it.prix || 0), 0) * 100) / 100;

  const { count } = await service
    .from("commandes_en_ligne")
    .select("id", { count: "exact", head: true })
    .eq("entreprise_id", employe.entreprise_id)
    .eq("source", "manuel");

  const id = crypto.randomUUID();
  const { error } = await service.from("commandes_en_ligne").insert({
    id,
    entreprise_id: employe.entreprise_id,
    source: "manuel",
    canal: "MANUEL",
    source_id: crypto.randomUUID(),
    numero: `M${(count || 0) + 1}`,
    statut: "APPROVED",
    statut_paiement: corps.paye ? "PAID" : "NOT_PAID",
    statut_preparation: "NOT_FULFILLED",
    mode,
    client_nom: String(corps.client_nom || "").trim().slice(0, 120) || null,
    total,
    items: articles,
    date_commande: new Date().toISOString(),
    date_ramassage: dateRamassage,
    date_ramassage_fin: null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Erreur création commande (employé):", error.message);
    return NextResponse.json({ error: "Impossible d'enregistrer la commande." }, { status: 500 });
  }

  // Comme au dashboard : tâches "Réservations" mises à jour, et bon imprimé
  // si le réglage des commandes manuelles est sur "automatique".
  await synchroniserTachesCommandes(service, employe.entreprise_id).catch((err) => console.error("Erreur tâches:", err.message));
  await imprimerAutomatiquement(service, employe.entreprise_id, id, { aLaCreation: true }).catch((err) =>
    console.error("Erreur impression automatique:", err.message)
  );

  return NextResponse.json({ ok: true, id });
}
