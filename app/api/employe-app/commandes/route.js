import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { aujourdhuiLocal } from "@/lib/dates";
import { bornesJour } from "@/lib/commandes";

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
