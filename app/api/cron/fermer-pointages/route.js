import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { fermerPointagesOublies } from "@/lib/pointageAuto";

// Filet de sécurité quotidien (Vercel Cron, voir vercel.json) : ferme les
// pointages oubliés de toutes les entreprises qui ont des horaires
// d'ouverture. Le gros du travail se fait déjà à l'ouverture de la feuille de
// temps et du pointage ; ce passage rattrape ce que personne n'a ouvert.

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

  const { data: emplacements } = await service
    .from("emplacements")
    .select("entreprise_id")
    .not("horaires_ouverture", "is", null);

  const entrepriseIds = [...new Set((emplacements || []).map((e) => e.entreprise_id))];
  let fermes = 0;
  for (const id of entrepriseIds) {
    fermes += await fermerPointagesOublies(service, id).catch(() => 0);
  }

  return NextResponse.json({ ok: true, pointagesFermes: fermes });
}
