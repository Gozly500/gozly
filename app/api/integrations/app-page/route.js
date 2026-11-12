import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { urlPageApp } from "@/lib/jetonApp";

export const dynamic = "force-dynamic";

// Adresse (avec jeton signé) de la page de gestion d'une app de développeur installée par l'entreprise.
export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { entrepriseId, integrationId, theme, accent, lang } = await request.json().catch(() => ({}));
  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!entreprise) return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });
  if (typeof integrationId !== "string" || !integrationId.startsWith("app:")) return NextResponse.json({ error: "App inconnue." }, { status: 400 });

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });

  const appId = integrationId.slice(4);
  const { data: installee } = await service
    .from("integrations_installees")
    .select("integration_id")
    .eq("entreprise_id", entreprise.id)
    .eq("integration_id", integrationId)
    .maybeSingle();
  const { data: app } = await service.from("apps_developpeur").select("*").eq("id", appId).eq("statut", "approuvee").maybeSingle();
  if (!installee || !app || !app.url_page) return NextResponse.json({ error: "Page indisponible." }, { status: 404 });

  return NextResponse.json({
    url: urlPageApp(app, { entrepriseId: entreprise.id, entrepriseNom: entreprise.nom, theme, accent, lang }),
  });
}
