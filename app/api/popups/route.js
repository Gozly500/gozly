import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { marquerPopupVu, popupsNonVus } from "@/lib/popupsServer";

export const dynamic = "force-dynamic";

async function utilisateur(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
  } = await getSupabaseForToken(token).auth.getUser(token);
  return user || null;
}

// Pop-ups d'ouverture pour les gestionnaires (tableau de bord et app Gestion) que cet utilisateur n'a pas encore vus.
export async function GET(request) {
  const user = await utilisateur(request);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ popups: [] });
  const popups = await popupsNonVus(service, { cible: "gestion", colonne: "user_id", id: user.id });
  return NextResponse.json({ popups });
}

// Marque un pop-up comme vu : { id }.
export async function POST(request) {
  const user = await utilisateur(request);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { id } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id manquant." }, { status: 400 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ ok: false });
  await marquerPopupVu(service, { colonne: "user_id", id: user.id }, id);
  return NextResponse.json({ ok: true });
}
