import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

export async function POST(request, { params }) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { accepte } = await request.json().catch(() => ({}));
  if (typeof accepte !== "boolean") {
    return NextResponse.json({ error: "Réponse invalide." }, { status: 400 });
  }

  const service = getServiceClient();
  const { data: demande } = await service
    .from("demandes_echange")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!demande || demande.entreprise_id !== employe.entreprise_id) {
    return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  }
  if (demande.employe_receveur_id !== employe.id) {
    return NextResponse.json({ error: "Cette demande ne te concerne pas." }, { status: 403 });
  }
  if (demande.statut_employe !== "en_attente") {
    return NextResponse.json({ error: "Cette demande a déjà été traitée." }, { status: 400 });
  }

  if (!accepte) {
    await service.from("demandes_echange").update({ statut_employe: "refuse", traite_le: new Date().toISOString() }).eq("id", demande.id);
    return NextResponse.json({ ok: true });
  }

  const { data: entreprise } = await service
    .from("entreprises")
    .select("auto_approuver_echanges")
    .eq("id", employe.entreprise_id)
    .maybeSingle();

  const auto = !!entreprise?.auto_approuver_echanges;

  await service
    .from("demandes_echange")
    .update({
      statut_employe: "accepte",
      statut_admin: auto ? "non_requis" : "en_attente",
      traite_le: new Date().toISOString(),
    })
    .eq("id", demande.id);

  if (auto) {
    await service.from("planning_quarts").update({ employe_id: employe.id }).eq("id", demande.quart_id);
  }

  return NextResponse.json({ ok: true, reassigne: auto });
}
