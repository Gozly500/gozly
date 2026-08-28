import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { estConforme } from "@/lib/temperature";

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();

  const { data: associations } = await service
    .from("employe_emplacements")
    .select("emplacement_id")
    .eq("employe_id", employe.id);
  const mesEmplacementIds = (associations || []).map((a) => a.emplacement_id);

  const { data: equipements } = await service
    .from("equipements_temperature")
    .select("*")
    .eq("entreprise_id", employe.entreprise_id)
    .order("nom", { ascending: true });

  // Un équipement sans succursale (emplacement_id null) est partagé/visible
  // par tous - sinon, seulement les employés associés à cette succursale.
  const equipementsVisibles = (equipements || []).filter(
    (eq) => !eq.emplacement_id || mesEmplacementIds.includes(eq.emplacement_id)
  );

  const debutJournee = new Date();
  debutJournee.setHours(0, 0, 0, 0);

  const { data: relevesDuJour } = await service
    .from("releves_temperature")
    .select("*")
    .eq("entreprise_id", employe.entreprise_id)
    .gte("created_at", debutJournee.toISOString())
    .order("created_at", { ascending: false });

  return NextResponse.json({ equipements: equipementsVisibles, relevesDuJour: relevesDuJour || [] });
}

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { equipementId, temperature, note } = await request.json().catch(() => ({}));
  const temp = parseFloat(temperature);
  if (!equipementId || Number.isNaN(temp)) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const service = getServiceClient();

  const { data: equipement } = await service
    .from("equipements_temperature")
    .select("id, type, entreprise_id")
    .eq("id", equipementId)
    .maybeSingle();

  if (!equipement || equipement.entreprise_id !== employe.entreprise_id) {
    return NextResponse.json({ error: "Équipement introuvable." }, { status: 404 });
  }

  const { error } = await service.from("releves_temperature").insert({
    entreprise_id: employe.entreprise_id,
    equipement_id: equipementId,
    employe_id: employe.id,
    releve_par: employe.nom,
    temperature: temp,
    conforme: estConforme(equipement.type, temp),
    note: note?.trim() || null,
  });

  if (error) {
    return NextResponse.json({ error: "L'enregistrement a échoué." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
