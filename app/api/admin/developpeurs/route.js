import { NextResponse } from "next/server";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";

// Demandes de compte développeur : liste et décision (approuver / refuser). Réservé aux admins.
export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  const { data: demandes, error } = await service.from("demandes_developpeur").select("*").order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "Table introuvable : exécute demandes_developpeur.sql dans Supabase." }, { status: 500 });
  }
  const { data: profils } = await service.from("profils").select("id, full_name");
  const { data: usersPage } = await service.auth.admin.listUsers({ perPage: 1000 });
  const noms = new Map((profils || []).map((p) => [p.id, p.full_name]));
  const courriels = new Map((usersPage?.users || []).map((u) => [u.id, u.email]));

  return NextResponse.json({
    demandes: (demandes || []).map((d) => ({
      id: d.id,
      statut: d.statut,
      created_at: d.created_at,
      nom: noms.get(d.profil_id) || "",
      courriel: courriels.get(d.profil_id) || "",
    })),
  });
}

export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  const { id, statut } = await request.json().catch(() => ({}));
  if (!id || !["en_attente", "approuvee", "refusee"].includes(statut)) {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }
  const { error } = await service
    .from("demandes_developpeur")
    .update({ statut, traitee_le: statut === "en_attente" ? null : new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: "La mise à jour a échoué." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
