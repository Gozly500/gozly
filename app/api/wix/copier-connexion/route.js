import { NextResponse } from "next/server";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";

// Relie ce dashboard au MÊME site Wix qu'un autre dashboard de l'utilisateur
// (copie l'instance de l'app Wix déjà installée). L'utilisateur doit être
// propriétaire des deux dashboards.
export async function POST(request) {
  const { entrepriseId, depuisEntrepriseId } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token || !entrepriseId || !depuisEntrepriseId || entrepriseId === depuisEntrepriseId) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const supabase = getSupabaseForToken(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  }

  const { data: membres } = await service
    .from("membres")
    .select("entreprise_id")
    .eq("user_id", user.id)
    .eq("role", "proprietaire")
    .in("entreprise_id", [entrepriseId, depuisEntrepriseId]);

  if ((membres || []).length < 2) {
    return NextResponse.json({ error: "Tu dois être propriétaire des deux dashboards." }, { status: 403 });
  }

  const { data: source } = await service
    .from("wix_connexions")
    .select("instance_id, statut")
    .eq("entreprise_id", depuisEntrepriseId)
    .maybeSingle();

  if (source?.statut !== "connecte" || !source.instance_id) {
    return NextResponse.json({ error: "Wix n'est pas connecté sur l'autre dashboard." }, { status: 400 });
  }

  const { error } = await service
    .from("wix_connexions")
    .upsert({ entreprise_id: entrepriseId, instance_id: source.instance_id, statut: "connecte" }, { onConflict: "entreprise_id" });

  if (error) {
    // Typiquement : wix_plusieurs_dashboards.sql pas encore exécuté (instance_id encore unique).
    console.error("Erreur copie connexion Wix:", error.message);
    return NextResponse.json({ error: "Impossible de relier ce dashboard.", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
