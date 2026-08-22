import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const { data: collegues } = await service
    .from("employes")
    .select("id, nom")
    .eq("entreprise_id", employe.entreprise_id)
    .neq("id", employe.id)
    .order("nom", { ascending: true });

  return NextResponse.json({ collegues: collegues || [] });
}
