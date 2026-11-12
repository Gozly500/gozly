import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";

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

  const { action, id } = await request.json().catch(() => ({}));

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
