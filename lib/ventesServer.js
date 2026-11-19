import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { lieuFiltreDashboard } from "@/lib/wixLieu";

// Vérifie l'utilisateur et sa connexion Wix pour les routes /api/ventes/*.
// Retourne { service, entreprise, instanceId, lieu } ou { erreur } (réponse prête à renvoyer).
export async function authentifierVentesWix(request, entrepriseId) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return { erreur: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user) return { erreur: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  if (!entreprise) return { erreur: NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 }) };

  const service = getServiceClient();
  if (!service) return { erreur: NextResponse.json({ error: "La connexion Wix n'est pas encore configurée." }, { status: 501 }) };

  const { data: connexion } = await service.from("wix_connexions").select("instance_id, statut").eq("entreprise_id", entreprise.id).maybeSingle();
  if (connexion?.statut !== "connecte" || !connexion.instance_id) {
    return { erreur: NextResponse.json({ error: "Wix n'est pas connecté. Va dans Paramètres → Intégrations." }, { status: 400 }) };
  }

  return { service, entreprise, instanceId: connexion.instance_id, lieu: await lieuFiltreDashboard(service, entreprise) };
}

export const DATE_VALIDE = /^\d{4}-\d{2}-\d{2}$/;
