import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { verifierWebhookWix } from "@/lib/wixClient";

// Reçoit le webhook "App Instance Installed" de Wix quand un client termine
// l'installation de l'app. Wix ne nous donne pas de moyen natif de savoir à
// quelle entreprise Gozly cette installation correspond (voir le
// commentaire dans wix_connexions.sql) - on associe donc l'instanceId reçu
// à la plus vieille ligne "en_attente" encore sans instance_id, créée par
// /api/wix/connecter quand le client a cliqué "Connecter Wix".
export async function POST(request) {
  const rawBody = await request.text();

  let event;
  try {
    event = verifierWebhookWix(rawBody);
  } catch (err) {
    console.error("Signature webhook Wix invalide:", err.message);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  const instanceId = event.instanceId;
  if (!instanceId) {
    return NextResponse.json({ ok: true });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ ok: true });
  }

  const { data: enAttente } = await service
    .from("wix_connexions")
    .select("id")
    .eq("statut", "en_attente")
    .is("instance_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (enAttente) {
    await service.from("wix_connexions").update({ instance_id: instanceId, statut: "connecte" }).eq("id", enAttente.id);
  } else {
    console.warn("Webhook Wix reçu (instanceId " + instanceId + ") sans ligne en_attente correspondante.");
  }

  return NextResponse.json({ ok: true });
}
