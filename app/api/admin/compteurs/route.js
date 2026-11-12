import { NextResponse } from "next/server";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

// Éléments non traités du panneau admin (pastilles rouges de la barre latérale).
export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  const [contact, developpeurs, apps] = await Promise.all([
    service.from("messages_contact").select("id", { count: "exact", head: true }).eq("traite", false),
    service.from("demandes_developpeur").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
    service.from("apps_developpeur").select("id", { count: "exact", head: true }).eq("statut", "soumise"),
  ]);

  return NextResponse.json({
    contact: contact.count || 0,
    developpeurs: developpeurs.count || 0,
    apps: apps.count || 0,
  });
}
