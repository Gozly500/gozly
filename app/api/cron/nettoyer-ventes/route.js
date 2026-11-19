import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { dateStr } from "@/lib/temperature";

// Nettoyage automatique des journées de ventes importées, une fois par jour (Vercel Cron, voir vercel.json) :
// supprime les journées plus vieilles que la durée choisie par l'entreprise (Modules > Suivi des ventes,
// entreprises.ventes_retention_mois : 3, 6 ou 12 mois). Les ventes entrées à la main ne sont pas touchées.
// Passe APRÈS l'export vers le stockage en ligne (exporter-stockage, 05:00 UTC).

export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });

  const maintenant = new Date();
  const { data: entreprises } = await service.from("entreprises").select("id, ventes_retention_mois");

  let supprimees = 0;
  for (const entreprise of entreprises || []) {
    const seuil = new Date(maintenant);
    seuil.setMonth(seuil.getMonth() - (entreprise.ventes_retention_mois || 12));
    const { data } = await service.from("ventes_jours").delete().eq("entreprise_id", entreprise.id).lt("date", dateStr(seuil)).select("id");
    supprimees += data?.length || 0;
  }

  return NextResponse.json({ ok: true, journeesSupprimees: supprimees });
}
