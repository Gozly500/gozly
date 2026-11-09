import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { normaliserPermissions, permissionsParDefaut } from "@/lib/iaModules";

export const dynamic = "force-dynamic";

// Permissions de l'IA d'une entreprise (Paramètres > Intégrations > Intelligence artificielle > Permissions de l'IA).
// Réservé au PROPRIÉTAIRE. Actions : lire | enregistrer
export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { action, entrepriseId, permissions } = await request.json().catch(() => ({}));

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!entreprise) return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });

  const { data: membre } = await service.from("membres").select("role").eq("entreprise_id", entreprise.id).eq("user_id", user.id).maybeSingle();
  if (membre?.role !== "proprietaire") {
    return NextResponse.json({ error: "Seul le propriétaire de l'entreprise peut gérer les permissions de l'IA." }, { status: 403 });
  }

  if (action === "lire") {
    const { data, error } = await service.from("ia_reglages").select("permissions").eq("entreprise_id", entreprise.id).maybeSingle();
    // Table absente : le SQL ia_reglages.sql n'est pas exécuté. Les valeurs par défaut s'appliquent quand même côté serveur.
    if (error) return NextResponse.json({ configure: false, permissions: permissionsParDefaut() });
    return NextResponse.json({ configure: true, permissions: normaliserPermissions(data?.permissions) });
  }

  if (action === "enregistrer") {
    const propres = normaliserPermissions(permissions);
    const { error } = await service
      .from("ia_reglages")
      .upsert({ entreprise_id: entreprise.id, permissions: propres, updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: "entreprise_id" });
    if (error) {
      console.error("Erreur enregistrement permissions IA:", error.message);
      return NextResponse.json({ error: "Impossible d'enregistrer. Le SQL des permissions de l'IA a-t-il été exécuté?" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, permissions: propres });
  }

  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}
