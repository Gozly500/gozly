import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";

// Vérifie l'utilisateur (jeton Bearer) et son entreprise pour les routes /api/stockage/*.
// Retourne { service, entreprise } ou { erreur } (une réponse prête à renvoyer).
export async function authentifierStockage(request, entrepriseId) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return { erreur: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user) return { erreur: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  if (!entreprise) return { erreur: NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 }) };

  const service = getServiceClient();
  if (!service) return { erreur: NextResponse.json({ error: "Le stockage en ligne n'est pas encore configuré." }, { status: 501 }) };

  return { service, entreprise };
}
