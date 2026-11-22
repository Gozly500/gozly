import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

// Enregistre (POST) ou retire (DELETE) le jeton FCM de l'app native de cet employé.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const { token, plateforme } = await request.json().catch(() => ({}));
  if (typeof token !== "string" || token.length < 20) return NextResponse.json({ error: "Jeton invalide." }, { status: 400 });

  const service = getServiceClient();
  // Le jeton appartient à l'appareil : si un autre employé se connecte sur ce téléphone, il lui est réassigné.
  const { error } = await service
    .from("employe_push_natifs")
    .upsert({ employe_id: employe.id, token, plateforme: plateforme === "ios" ? "ios" : "android" }, { onConflict: "token" });
  if (error) {
    console.error("Erreur enregistrement jeton natif:", error);
    return NextResponse.json({ error: "L'enregistrement a échoué." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const { token } = await request.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Jeton manquant." }, { status: 400 });

  const service = getServiceClient();
  await service.from("employe_push_natifs").delete().eq("employe_id", employe.id).eq("token", token);
  return NextResponse.json({ ok: true });
}
