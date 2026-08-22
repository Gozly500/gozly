import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const { data: demandes } = await service
    .from("demandes_conge")
    .select("*")
    .eq("employe_id", employe.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ demandes: demandes || [] });
}

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { dateDebut, dateFin, raison } = await request.json().catch(() => ({}));
  if (!dateDebut || !dateFin) {
    return NextResponse.json({ error: "Dates de début et de fin requises." }, { status: 400 });
  }
  if (new Date(dateFin) < new Date(dateDebut)) {
    return NextResponse.json({ error: "La date de fin doit être après la date de début." }, { status: 400 });
  }

  const service = getServiceClient();
  const { data: demande, error } = await service
    .from("demandes_conge")
    .insert({
      entreprise_id: employe.entreprise_id,
      employe_id: employe.id,
      date_debut: dateDebut,
      date_fin: dateFin,
      raison: raison?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erreur création demande de congé:", error);
    return NextResponse.json({ error: "La demande a échoué." }, { status: 500 });
  }

  return NextResponse.json({ demande });
}
