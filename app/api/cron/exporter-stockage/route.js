import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { exporterSiNecessaire } from "@/lib/exportsStockage";

// Exports automatiques vers le stockage en ligne des entreprises (OneDrive), déclenchés une fois par jour par
// Vercel Cron (voir vercel.json) : dépose la dernière semaine ou le dernier mois complet de fiches de
// température, selon le réglage de l'entreprise. Passe AVANT le nettoyage des fiches (nettoyer-temperatures).

export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  }

  const { data: connexions } = await service
    .from("stockage_connexions")
    .select("*")
    .eq("statut", "connecte")
    .in("export_temperatures", ["hebdo", "mensuel"]);

  let exportes = 0;
  let echecs = 0;
  for (const connexion of connexions || []) {
    const resultat = await exporterSiNecessaire(service, connexion);
    if (resultat.ok) exportes += 1;
    if (resultat.erreur) echecs += 1;
  }

  return NextResponse.json({ ok: true, exportes, echecs });
}
