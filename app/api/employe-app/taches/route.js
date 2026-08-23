import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();

  const { data: associations } = await service
    .from("employe_emplacements")
    .select("emplacement_id")
    .eq("employe_id", employe.id);

  const emplacementIds = (associations || []).map((a) => a.emplacement_id);
  if (emplacementIds.length === 0) {
    return NextResponse.json({ taches: [] });
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);

  const { data: taches } = await service
    .from("taches")
    .select("id, texte, terminee, categorie:categorie_id(id, nom)")
    .eq("entreprise_id", employe.entreprise_id)
    .eq("date", aujourdhui)
    .in("emplacement_id", emplacementIds)
    .order("created_at", { ascending: true });

  return NextResponse.json({ taches: taches || [] });
}
