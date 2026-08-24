import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntreprise } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { WIX_INSTALL_LINK } from "@/lib/wixClient";

// Crée (ou réinitialise) une ligne "en_attente" pour cette entreprise AVANT
// que le client aille sur Wix - c'est ce qui permet au webhook
// /api/wix/webhook de savoir à quelle entreprise associer l'instanceId
// reçu ensuite (voir le commentaire dans wix_connexions.sql).
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntreprise(supabase, token);

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!entreprise) {
    return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "La connexion à Wix n'est pas encore configurée." }, { status: 501 });
  }

  const { error } = await service.from("wix_connexions").upsert(
    { entreprise_id: entreprise.id, instance_id: null, statut: "en_attente", created_at: new Date().toISOString() },
    { onConflict: "entreprise_id" }
  );

  if (error) {
    console.error("Erreur préparation connexion Wix:", error);
    return NextResponse.json({ error: "La connexion a échoué." }, { status: 500 });
  }

  return NextResponse.json({ lienInstallation: WIX_INSTALL_LINK });
}
