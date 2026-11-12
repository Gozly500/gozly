import { NextResponse } from "next/server";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";

// Fiches d'apps des développeurs : liste et décision (approuver / refuser). Réservé aux admins.
export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  const { data: apps, error } = await service.from("apps_developpeur").select("*").neq("statut", "brouillon").order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Table introuvable : exécute apps_developpeur.sql dans Supabase." }, { status: 500 });

  const { data: profils } = await service.from("profils").select("id, full_name");
  const { data: usersPage } = await service.auth.admin.listUsers({ perPage: 1000 });
  const noms = new Map((profils || []).map((p) => [p.id, p.full_name]));
  const courriels = new Map((usersPage?.users || []).map((u) => [u.id, u.email]));

  return NextResponse.json({
    apps: (apps || []).map((a) => ({
      ...a,
      developpeur: a.proprietaire_id ? noms.get(a.proprietaire_id) || courriels.get(a.proprietaire_id) || "" : "",
    })),
  });
}

export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  const { id, statut, note } = await request.json().catch(() => ({}));
  if (!id || !["approuvee", "refusee"].includes(statut)) {
    return NextResponse.json({ error: "Décision invalide." }, { status: 400 });
  }
  const { error } = await service
    .from("apps_developpeur")
    .update({ statut, note_refus: statut === "refusee" ? String(note || "").slice(0, 500) || null : null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "La mise à jour a échoué." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
