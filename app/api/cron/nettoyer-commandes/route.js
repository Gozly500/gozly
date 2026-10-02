import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";

// Nettoyage automatique des commandes en ligne, déclenché une fois par jour
// par Vercel Cron (voir vercel.json) :
// - supprime les commandes COPIÉES d'une plateforme (Wix...) plus vieilles
//   que la durée choisie par l'entreprise (Personnalisation > Commandes en
//   ligne, entreprises.commandes_retention_mois - 12 mois par défaut) : le
//   registre officiel reste sur la plateforme d'origine ;
// - ne touche JAMAIS aux commandes manuelles (source = 'manuel') ;
// - vide la colonne `brut` (copie complète de la commande) après 60 jours.

const JOURS_AVANT_VIDAGE_BRUT = 60;

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
  const { data: entreprises } = await service.from("entreprises").select("id, commandes_retention_mois");

  let supprimees = 0;

  for (const entreprise of entreprises || []) {
    const seuil = new Date(maintenant);
    seuil.setMonth(seuil.getMonth() - (entreprise.commandes_retention_mois || 12));

    const { data } = await service
      .from("commandes_en_ligne")
      .delete()
      .eq("entreprise_id", entreprise.id)
      .neq("source", "manuel")
      .lt("date_commande", seuil.toISOString())
      .select("id");
    supprimees += data?.length || 0;
  }

  const seuilBrut = new Date(maintenant.getTime() - JOURS_AVANT_VIDAGE_BRUT * 24 * 60 * 60 * 1000);
  await service
    .from("commandes_en_ligne")
    .update({ brut: null })
    .lt("date_commande", seuilBrut.toISOString())
    .not("brut", "is", null);

  // La file d'impression ne sert qu'à court terme : on garde 7 jours d'historique.
  const seuilBons = new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000);
  await service.from("bons_impression").delete().lt("created_at", seuilBons.toISOString());

  return NextResponse.json({ ok: true, commandesSupprimees: supprimees });
}
