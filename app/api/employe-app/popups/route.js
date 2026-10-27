import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { marquerPopupVu, popupsNonVus } from "@/lib/popupsServer";

export const dynamic = "force-dynamic";

// Pop-ups d'ouverture que cet employé n'a pas encore vus (voir supabase/popups_app.sql).
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ popups: [] });
  const popups = await popupsNonVus(service, { cible: "employes", colonne: "employe_id", id: employe.id });
  return NextResponse.json({ popups });
}

// Marque un pop-up comme vu : { id }.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  const { id } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id manquant." }, { status: 400 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ ok: false });
  await marquerPopupVu(service, { colonne: "employe_id", id: employe.id }, id);
  return NextResponse.json({ ok: true });
}
