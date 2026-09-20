import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";

// Nettoyage automatique des demandes (congés + échanges de quart),
// déclenché une fois par jour par Vercel Cron (voir vercel.json) :
//
// 1. Une demande jamais traitée après DELAI_EXPIRATION_EN_ATTENTE_JOURS
//    est supprimée automatiquement - l'employé doit en renvoyer une.
// 2. Une demande déjà traitée (approuvée/refusée) est supprimée après le
//    délai de conservation choisi par l'entreprise (Personnalisation >
//    Horaire & Pointage, entreprises.demandes_retention_mois).
//
// "Traité" pour un échange de quart veut dire : refusé par l'employé
// (statut_admin ne s'applique jamais dans ce cas), ou accepté par
// l'employé ET tranché par l'admin (approuvé/refusé/non requis).
// statut_employe='accepte' + statut_admin='en_attente' reste "en attente"
// même si traite_le a déjà une valeur (mise à jour au moment de
// l'acceptation employé, pas encore de la décision finale).

const DELAI_EXPIRATION_EN_ATTENTE_JOURS = 14;

function estEchangeEnAttente(e) {
  return e.statut_employe === "en_attente" || (e.statut_employe === "accepte" && e.statut_admin === "en_attente");
}

function estEchangeTraite(e) {
  return e.statut_employe === "refuse" || (e.statut_employe === "accepte" && e.statut_admin !== "en_attente");
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  // Sans CRON_SECRET configuré, refuser tout : sinon "Bearer undefined" passerait.
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  }

  const maintenant = new Date();
  const seuilEnAttenteIso = new Date(maintenant.getTime() - DELAI_EXPIRATION_EN_ATTENTE_JOURS * 86400000).toISOString();

  const { data: congesExpires } = await service
    .from("demandes_conge")
    .delete()
    .eq("statut", "en_attente")
    .lt("created_at", seuilEnAttenteIso)
    .select("id");

  const { data: echangesAnciens } = await service
    .from("demandes_echange")
    .select("id, statut_employe, statut_admin")
    .lt("created_at", seuilEnAttenteIso);

  const idsEchangesExpires = (echangesAnciens || []).filter(estEchangeEnAttente).map((e) => e.id);
  if (idsEchangesExpires.length > 0) {
    await service.from("demandes_echange").delete().in("id", idsEchangesExpires);
  }

  const { data: entreprises } = await service.from("entreprises").select("id, demandes_retention_mois");

  let congesConserves = 0;
  let echangesConserves = 0;

  for (const entreprise of entreprises || []) {
    const seuilConservation = new Date(maintenant);
    seuilConservation.setMonth(seuilConservation.getMonth() - (entreprise.demandes_retention_mois || 6));
    const seuilConservationIso = seuilConservation.toISOString();

    const { data: c } = await service
      .from("demandes_conge")
      .delete()
      .eq("entreprise_id", entreprise.id)
      .neq("statut", "en_attente")
      .lt("traite_le", seuilConservationIso)
      .select("id");
    congesConserves += c?.length || 0;

    const { data: echangesTraites } = await service
      .from("demandes_echange")
      .select("id, statut_employe, statut_admin")
      .eq("entreprise_id", entreprise.id)
      .lt("traite_le", seuilConservationIso);

    const idsResolus = (echangesTraites || []).filter(estEchangeTraite).map((e) => e.id);
    if (idsResolus.length > 0) {
      await service.from("demandes_echange").delete().in("id", idsResolus);
      echangesConserves += idsResolus.length;
    }
  }

  return NextResponse.json({
    ok: true,
    congesExpires: congesExpires?.length || 0,
    echangesExpires: idsEchangesExpires.length,
    congesSupprimesConservation: congesConserves,
    echangesSupprimesConservation: echangesConserves,
  });
}
