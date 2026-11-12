import { NextResponse } from "next/server";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";
import { urlPageApp } from "@/lib/jetonApp";

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
    apps: (apps || []).map(({ secret_page, ...a }) => ({
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

  const { id, statut, note, supprimer, apercu, theme, accent, lang } = await request.json().catch(() => ({}));
  if (apercu && id) {
    const { data: app } = await service.from("apps_developpeur").select("*").eq("id", id).maybeSingle();
    if (!app || !app.url_page) return NextResponse.json({ error: "Cette app n'a pas de page." }, { status: 404 });
    return NextResponse.json({ url: urlPageApp(app, { entrepriseId: "apercu", entrepriseNom: "Entreprise de test", apercu: true, theme, accent, lang }) });
  }
  if (supprimer && id) {
    await service.from("integrations_installees").delete().eq("integration_id", `app:${id}`);
    const { error: erreurSuppr } = await service.from("apps_developpeur").delete().eq("id", id);
    if (erreurSuppr) return NextResponse.json({ error: "La suppression a échoué." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
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
