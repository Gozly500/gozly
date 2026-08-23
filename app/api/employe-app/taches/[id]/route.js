import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

export async function PATCH(request, { params }) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { terminee } = await request.json().catch(() => ({}));
  if (typeof terminee !== "boolean") {
    return NextResponse.json({ error: "Valeur invalide." }, { status: 400 });
  }

  const service = getServiceClient();
  const { data: tache } = await service.from("taches").select("id, entreprise_id").eq("id", params.id).maybeSingle();

  if (!tache || tache.entreprise_id !== employe.entreprise_id) {
    return NextResponse.json({ error: "Tâche introuvable." }, { status: 404 });
  }

  await service.from("taches").update({ terminee }).eq("id", tache.id);

  return NextResponse.json({ ok: true });
}
