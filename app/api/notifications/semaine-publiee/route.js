import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken, getUserEntreprise } from "@/lib/stripeServer";
import { envoyerPushEmployes } from "@/lib/pushServer";

// Déclenché par HoraireSection.jsx (dashboard) juste après avoir publié
// une semaine - la mise à jour elle-même se fait client-side via RLS,
// mais l'envoi du push a besoin de web-push (Node), donc doit passer par
// une route serveur (même raison que /api/notifications/chat).
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntreprise(supabase, token);
  if (!user || !entreprise) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { dateDebut, dateFin, emplacementId } = await request.json().catch(() => ({}));
  if (!dateDebut || !dateFin) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const service = getServiceClient();

  let query = service
    .from("planning_quarts")
    .select("employe_id")
    .eq("entreprise_id", entreprise.id)
    .eq("publie", true)
    .gte("date", dateDebut)
    .lte("date", dateFin);
  if (emplacementId) query = query.eq("emplacement_id", emplacementId);

  const { data: quarts } = await query;
  const employeIds = [...new Set((quarts || []).map((q) => q.employe_id).filter(Boolean))];

  await envoyerPushEmployes(
    service,
    employeIds,
    {
      titre: "Nouvel horaire",
      corps: "Ton horaire a été publié.",
      url: "/moi/horaire",
    },
    "notif_semaine_publiee"
  ).catch((err) => console.error("Erreur notification push:", err));

  return NextResponse.json({ ok: true });
}
