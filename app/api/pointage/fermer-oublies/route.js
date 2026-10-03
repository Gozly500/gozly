import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { fermerPointagesOublies } from "@/lib/pointageAuto";

// Ferme les pointages oubliés de l'entreprise (voir lib/pointageAuto.js).
// Appelé à l'ouverture de la feuille de temps et du pointage au kiosque, pour
// que l'écran reflète la réalité sans attendre le nettoyage quotidien.
export async function POST(request) {
  const { entrepriseId } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user || !entreprise) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ ok: true, fermes: 0 });
  }

  try {
    const fermes = await fermerPointagesOublies(service, entreprise.id);
    return NextResponse.json({ ok: true, fermes });
  } catch (err) {
    console.error("Erreur fermeture des pointages oubliés:", err.message);
    return NextResponse.json({ ok: true, fermes: 0 });
  }
}
