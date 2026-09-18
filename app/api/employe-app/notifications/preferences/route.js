import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

const COLONNES = ["notif_messages", "notif_conge_traite", "notif_echange_recu", "notif_echange_traite", "notif_semaine_publiee"];

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const { data } = await service.from("employes").select(COLONNES.join(", ")).eq("id", employe.id).maybeSingle();

  return NextResponse.json({ preferences: data || {} });
}

export async function PATCH(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const champs = {};
  for (const colonne of COLONNES) {
    if (typeof body[colonne] === "boolean") champs[colonne] = body[colonne];
  }
  if (Object.keys(champs).length === 0) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const service = getServiceClient();
  const { error } = await service.from("employes").update(champs).eq("id", employe.id);
  if (error) {
    return NextResponse.json({ error: "L'enregistrement a échoué." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
