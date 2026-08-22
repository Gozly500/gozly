import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const { data: entreprise } = await service
    .from("entreprises")
    .select("nom, premier_jour_semaine")
    .eq("id", employe.entreprise_id)
    .maybeSingle();

  return NextResponse.json({
    employe: { id: employe.id, nom: employe.nom },
    entreprise: { nom: entreprise?.nom || "", premierJourSemaine: entreprise?.premier_jour_semaine || "lundi" },
  });
}
