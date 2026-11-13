import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { urlPageApp } from "@/lib/jetonApp";
import { genererCleApp } from "@/lib/appApi";

export const dynamic = "force-dynamic";

// Actions d'un développeur sur SES apps (clé service_role : l'app approuvée ne peut pas être modifiée par RLS).
//  - compter  { id }  : combien d'entreprises ont installé l'app
//  - retirer  { id }  : supprime l'app (et ses installations)
//  - laisser          : le développeur laisse toutes ses apps après la suppression de son compte (accord enregistré)
export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
  const {
    data: { user },
  } = await service.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { action, id, theme, accent, lang } = await request.json().catch(() => ({}));

  // Aperçu de sa page, avec une entreprise de test (le jeton porte « apercu: true »).
  if (action === "apercu") {
    const { data: app } = await service.from("apps_developpeur").select("*").eq("id", id).maybeSingle();
    if (!app || app.proprietaire_id !== user.id || !app.url_page) return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
    return NextResponse.json({ url: urlPageApp(app, { entrepriseId: "apercu", entrepriseNom: "Entreprise de test", apercu: true, theme, accent, lang }) });
  }

  // Nouvelle clé d'API (l'ancienne cesse de marcher). La clé complète n'est montrée qu'une fois : seul son hash est gardé.
  if (action === "cle") {
    const { data: app } = await service.from("apps_developpeur").select("id, proprietaire_id").eq("id", id).maybeSingle();
    if (!app || app.proprietaire_id !== user.id) return NextResponse.json({ error: "App introuvable." }, { status: 404 });
    const { cle, hash, prefixe } = genererCleApp();
    const { error } = await service.from("apps_developpeur").update({ cle_api_hash: hash, cle_api_prefixe: prefixe }).eq("id", app.id);
    if (error) return NextResponse.json({ error: "Exécute apps_api.sql dans Supabase." }, { status: 500 });
    return NextResponse.json({ cle, prefixe });
  }

  if (action === "laisser") {
    const { error } = await service
      .from("apps_developpeur")
      .update({ accord_orpheline_le: new Date().toISOString() })
      .eq("proprietaire_id", user.id);
    if (error) return NextResponse.json({ error: "L'enregistrement a échoué." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action !== "compter" && action !== "retirer") return NextResponse.json({ error: "Action invalide." }, { status: 400 });

  const { data: app } = await service.from("apps_developpeur").select("id, proprietaire_id").eq("id", id).maybeSingle();
  if (!app || app.proprietaire_id !== user.id) return NextResponse.json({ error: "App introuvable." }, { status: 404 });

  const cle = `app:${app.id}`;
  if (action === "compter") {
    const { count } = await service.from("integrations_installees").select("entreprise_id", { count: "exact", head: true }).eq("integration_id", cle);
    return NextResponse.json({ installations: count || 0 });
  }

  await service.from("integrations_installees").delete().eq("integration_id", cle);
  const { error } = await service.from("apps_developpeur").delete().eq("id", app.id);
  if (error) return NextResponse.json({ error: "La suppression a échoué." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
