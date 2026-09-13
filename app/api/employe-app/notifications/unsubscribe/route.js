import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { endpoint } = await request.json().catch(() => ({}));
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint manquant." }, { status: 400 });
  }

  const service = getServiceClient();
  await service.from("employe_push_subscriptions").delete().eq("employe_id", employe.id).eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
