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

  // Usage : appels d'aujourd'hui et des 30 derniers jours, par app.
  const usage = { jour: new Map(), mois: new Map() };
  const depuis = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const { data: lignes } = await service.from("app_usage_jour").select("app_id, jour, n").gte("jour", depuis);
  for (const l of lignes || []) {
    usage.mois.set(l.app_id, (usage.mois.get(l.app_id) || 0) + l.n);
    if (l.jour === aujourdhui) usage.jour.set(l.app_id, (usage.jour.get(l.app_id) || 0) + l.n);
  }

  return NextResponse.json({
    apps: (apps || []).map(({ secret_page, cle_api_hash, ...a }) => ({
      ...a,
      usage_jour: usage.jour.get(a.id) || 0,
      usage_30j: usage.mois.get(a.id) || 0,
      developpeur: a.proprietaire_id ? noms.get(a.proprietaire_id) || courriels.get(a.proprietaire_id) || "" : "",
    })),
  });
}

export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  const { id, statut, note, supprimer, apercu, theme, accent, lang, suspendre, raison, limites } = await request.json().catch(() => ({}));
  if (id && typeof suspendre === "boolean") {
    const { error } = await service
      .from("apps_developpeur")
      .update({ suspendue: suspendre, suspendue_raison: suspendre ? String(raison || "").slice(0, 300) || "Suspendue par Gozly." : null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Exécute apps_api.sql dans Supabase." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (id && limites && typeof limites === "object") {
    const n = (v, max) => (Number.isInteger(v) && v >= 1 && v <= max ? v : null);
    const maj = {
      limite_min_entreprise: n(limites.limite_min_entreprise, 10000),
      limite_min_app: n(limites.limite_min_app, 100000),
      limite_jour: n(limites.limite_jour, 10000000),
    };
    if (Object.values(maj).some((v) => v === null)) return NextResponse.json({ error: "Limites invalides." }, { status: 400 });
    const { error } = await service.from("apps_developpeur").update(maj).eq("id", id);
    if (error) return NextResponse.json({ error: "La mise à jour a échoué." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
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
