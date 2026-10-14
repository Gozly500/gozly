import { NextResponse } from "next/server";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";
import { CLES_STATUT } from "@/lib/statutServer";

// GET : l'appelant est-il admin ? (sert à afficher les boutons de modification sur /statut)
export async function GET(request) {
  const { errorStatus } = await requireAdmin(request);
  return NextResponse.json({ admin: !errorStatus });
}

// POST { cle, etat: "ok"|"probleme"|"panne"|null, message } - etat null = retour à la détection automatique.
export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });

  const { cle, etat, message } = await request.json();
  if (!CLES_STATUT.includes(cle)) return NextResponse.json({ error: "Système inconnu." }, { status: 400 });

  if (!etat) {
    const { error } = await service.from("statut_overrides").delete().eq("cle", cle);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (!["ok", "probleme", "panne"].includes(etat)) return NextResponse.json({ error: "État invalide." }, { status: 400 });

  const { error } = await service
    .from("statut_overrides")
    .upsert({ cle, etat, message: (message || "").trim().slice(0, 300) || null, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
