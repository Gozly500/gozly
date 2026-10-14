import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

const COLONNES = ["notif_messages", "notif_conge_traite", "notif_echange_recu", "notif_echange_traite", "notif_semaine_publiee"];

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const { data } = await service.from("employes").select(COLONNES.join(", ")).eq("id", employe.id).maybeSingle();

  // Heures calmes (supabase/notifications_sourdine.sql) : null tant que les colonnes n'existent pas.
  let heuresCalmes = null;
  const { data: calmes, error: erreurCalmes } = await service.from("employes").select("heures_calmes_actif, heures_calmes_debut, heures_calmes_fin").eq("id", employe.id).maybeSingle();
  if (!erreurCalmes && calmes) {
    heuresCalmes = {
      actif: !!calmes.heures_calmes_actif,
      debut: String(calmes.heures_calmes_debut || "22:00").slice(0, 5),
      fin: String(calmes.heures_calmes_fin || "07:00").slice(0, 5),
    };
  }

  return NextResponse.json({ preferences: data || {}, heuresCalmes });
}

export async function PATCH(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const champs = {};
  for (const colonne of COLONNES) {
    if (typeof body[colonne] === "boolean") champs[colonne] = body[colonne];
  }
  // Heures calmes
  if (typeof body.heures_calmes_actif === "boolean") champs.heures_calmes_actif = body.heures_calmes_actif;
  for (const colonne of ["heures_calmes_debut", "heures_calmes_fin"]) {
    if (typeof body[colonne] === "string" && /^\d{2}:\d{2}$/.test(body[colonne])) champs[colonne] = body[colonne];
  }
  if (Object.keys(champs).length === 0) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const service = getServiceClient();
  const { error } = await service.from("employes").update(champs).eq("id", employe.id);
  if (error) {
    return NextResponse.json({ error: "L'enregistrement a échoué." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
