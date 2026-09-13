import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { subscription } = await request.json().catch(() => ({}));
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });
  }

  const service = getServiceClient();
  const { error } = await service
    .from("employe_push_subscriptions")
    .upsert({ employe_id: employe.id, endpoint, p256dh, auth }, { onConflict: "endpoint" });

  if (error) {
    console.error("Erreur enregistrement abonnement push:", error);
    return NextResponse.json({ error: "L'activation a échoué." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
