import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { dateStr } from "@/lib/temperature";

// Nettoyage automatique des relevés de température, déclenché une fois par
// jour par Vercel Cron (voir vercel.json) : supprime les relevés plus vieux
// que la durée de conservation choisie par l'entreprise (Personnalisation >
// Températures, entreprises.temperature_retention_mois - 3 mois par défaut).
// L'entreprise peut exporter ses fiches en Excel avant qu'elles disparaissent.

export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  }

  const maintenant = new Date();
  const { data: entreprises } = await service.from("entreprises").select("id, temperature_retention_mois");

  let supprimes = 0;

  for (const entreprise of entreprises || []) {
    const seuil = new Date(maintenant);
    seuil.setMonth(seuil.getMonth() - (entreprise.temperature_retention_mois || 3));

    const { data } = await service
      .from("releves_temperature")
      .delete()
      .eq("entreprise_id", entreprise.id)
      .lt("date_relevee", dateStr(seuil))
      .select("id");
    supprimes += data?.length || 0;
  }

  return NextResponse.json({ ok: true, relevesSupprimes: supprimes });
}
