import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const semaine = searchParams.get("semaine");
  if (!semaine) {
    return NextResponse.json({ error: "Semaine manquante." }, { status: 400 });
  }

  const debut = new Date(semaine);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 7);
  const finISO = fin.toISOString().slice(0, 10);

  const service = getServiceClient();
  const { data: quarts } = await service
    .from("planning_quarts")
    .select("id, date, heure_debut, heure_fin")
    .eq("employe_id", employe.id)
    .gte("date", semaine)
    .lt("date", finISO)
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  return NextResponse.json({ quarts: quarts || [] });
}
