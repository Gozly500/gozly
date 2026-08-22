import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

async function resoudreNomsEmployes(service, ids) {
  if (ids.length === 0) return [];
  const { data } = await service.from("employes").select("id, nom").in("id", ids);
  return data || [];
}

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const { data: demandes } = await service
    .from("demandes_echange")
    .select("*, planning_quarts(date, heure_debut, heure_fin)")
    .or(`employe_donneur_id.eq.${employe.id},employe_receveur_id.eq.${employe.id}`)
    .order("created_at", { ascending: false });

  const autresIds = [
    ...new Set(
      (demandes || []).map((d) => (d.employe_donneur_id === employe.id ? d.employe_receveur_id : d.employe_donneur_id))
    ),
  ];
  const employes = await resoudreNomsEmployes(service, autresIds);

  const enrichies = (demandes || []).map((d) => {
    const jeSuisDonneur = d.employe_donneur_id === employe.id;
    const autreId = jeSuisDonneur ? d.employe_receveur_id : d.employe_donneur_id;
    return {
      id: d.id,
      role: jeSuisDonneur ? "donneur" : "receveur",
      autreNom: employes.find((e) => e.id === autreId)?.nom || "Collègue",
      quart: d.planning_quarts,
      statutEmploye: d.statut_employe,
      statutAdmin: d.statut_admin,
      createdAt: d.created_at,
    };
  });

  return NextResponse.json({ demandes: enrichies });
}

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { quartId, avecEmployeId } = await request.json().catch(() => ({}));
  if (!quartId || !avecEmployeId) {
    return NextResponse.json({ error: "Quart et collègue requis." }, { status: 400 });
  }
  if (avecEmployeId === employe.id) {
    return NextResponse.json({ error: "Tu ne peux pas t'échanger un quart avec toi-même." }, { status: 400 });
  }

  const service = getServiceClient();

  const { data: quart } = await service
    .from("planning_quarts")
    .select("id, employe_id, entreprise_id")
    .eq("id", quartId)
    .maybeSingle();

  if (!quart || quart.entreprise_id !== employe.entreprise_id) {
    return NextResponse.json({ error: "Quart introuvable." }, { status: 404 });
  }
  if (quart.employe_id !== employe.id) {
    return NextResponse.json({ error: "Ce quart ne t'appartient pas." }, { status: 403 });
  }

  const { data: autre } = await service
    .from("employes")
    .select("id, entreprise_id")
    .eq("id", avecEmployeId)
    .maybeSingle();
  if (!autre || autre.entreprise_id !== employe.entreprise_id) {
    return NextResponse.json({ error: "Collègue introuvable." }, { status: 404 });
  }

  const { data: demande, error } = await service
    .from("demandes_echange")
    .insert({
      entreprise_id: employe.entreprise_id,
      quart_id: quartId,
      employe_donneur_id: employe.id,
      employe_receveur_id: avecEmployeId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erreur création demande d'échange:", error);
    return NextResponse.json({ error: "La demande a échoué." }, { status: 500 });
  }

  return NextResponse.json({ demande });
}
