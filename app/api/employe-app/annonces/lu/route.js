import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

// L'employé a touché « OK » sur une annonce : on l'enregistre (accusé de lecture, voir supabase/annonces_lectures.sql)
// pour que le propriétaire voie qui l'a lue. Sans conséquence si la table n'existe pas encore.
export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { annonceId } = await request.json().catch(() => ({}));
  if (!annonceId) {
    return NextResponse.json({ error: "Annonce manquante." }, { status: 400 });
  }

  const service = getServiceClient();

  // L'annonce doit être celle de son entreprise.
  const { data: annonce } = await service.from("annonces").select("id").eq("id", annonceId).eq("entreprise_id", employe.entreprise_id).maybeSingle();
  if (!annonce) {
    return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
  }

  const { error } = await service
    .from("annonce_lectures")
    .upsert({ annonce_id: annonceId, employe_id: employe.id, lu_le: new Date().toISOString() }, { onConflict: "annonce_id,employe_id" });
  if (error) {
    console.error("Erreur accusé de lecture:", error.message);
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true });
}
