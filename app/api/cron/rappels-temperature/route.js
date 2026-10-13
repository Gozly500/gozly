import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { envoyerRappelsTemperature } from "@/lib/rappelsTemperature";

// Rappels de températures : appelé à 11 h 30 et 23 h 30, heure du Québec, par la planification Supabase
// (pg_cron, voir supabase/cron_rappels.sql), chacun avec son heure UTC d'été et d'hiver - voir creneauARappeler. Envoie « N'oubliez pas d'enregistrer
// les températures » aux employés au travail quand aucun relevé n'a été fait pour le créneau en cours.

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

  const resultat = await envoyerRappelsTemperature(service);
  return NextResponse.json({ ok: true, ...resultat });
}
