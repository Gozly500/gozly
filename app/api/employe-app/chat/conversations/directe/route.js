import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { getOrCreateDirecteConversation } from "@/lib/chatServer";

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { avecEmployeId } = await request.json().catch(() => ({}));
  if (!avecEmployeId) {
    return NextResponse.json({ error: "avecEmployeId manquant." }, { status: 400 });
  }

  const service = getServiceClient();

  const { data: autre } = await service
    .from("employes")
    .select("id, entreprise_id")
    .eq("id", avecEmployeId)
    .maybeSingle();

  if (!autre || autre.entreprise_id !== employe.entreprise_id) {
    return NextResponse.json({ error: "Employé introuvable." }, { status: 404 });
  }

  const conversationId = await getOrCreateDirecteConversation(
    service,
    employe.entreprise_id,
    { employeId: employe.id },
    { employeId: autre.id }
  );

  return NextResponse.json({ conversationId });
}
