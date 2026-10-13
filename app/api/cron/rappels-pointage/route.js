import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { envoyerRappelsPointage } from "@/lib/rappelsPointage";

// Rappel de pointage : appelé toutes les 5 minutes par la planification Supabase (pg_cron, voir
// supabase/cron_rappels.sql) - Vercel Hobby ne permet qu'un passage par jour. Envoie « N'oublie pas de
// pointer » aux employés dont le quart a commencé depuis 10 minutes sans pointage.

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

  const resultat = await envoyerRappelsPointage(service);
  return NextResponse.json({ ok: true, ...resultat });
}
