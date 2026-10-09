import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { envoyerPushEmployes } from "@/lib/pushServer";
import { erreurPlage } from "@/lib/echangeQuart";

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
      heureDebut: d.heure_debut ? String(d.heure_debut).slice(0, 5) : null,
      heureFin: d.heure_fin ? String(d.heure_fin).slice(0, 5) : null,
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

  const { quartId, avecEmployeId, heureDebut, heureFin } = await request.json().catch(() => ({}));
  if (!quartId || !avecEmployeId) {
    return NextResponse.json({ error: "Quart et collègue requis." }, { status: 400 });
  }
  if (avecEmployeId === employe.id) {
    return NextResponse.json({ error: "Tu ne peux pas t'échanger un quart avec toi-même." }, { status: 400 });
  }

  const service = getServiceClient();

  const { data: entreprise } = await service
    .from("entreprises")
    .select("echanges_actif")
    .eq("id", employe.entreprise_id)
    .maybeSingle();

  if (entreprise && entreprise.echanges_actif === false) {
    return NextResponse.json({ error: "Les échanges de quart sont désactivés pour ton entreprise." }, { status: 403 });
  }

  const { data: quart } = await service
    .from("planning_quarts")
    .select("id, employe_id, entreprise_id, heure_debut, heure_fin")
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

  // Échange partiel : seulement si les heures choisies ne couvrent pas déjà le quart au complet.
  const partiel = heureDebut && heureFin && !(heureDebut === quart.heure_debut.slice(0, 5) && heureFin === quart.heure_fin.slice(0, 5));
  if (partiel) {
    const erreur = erreurPlage(heureDebut, heureFin, quart);
    if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });
  }

  const { data: demande, error } = await service
    .from("demandes_echange")
    .insert({
      entreprise_id: employe.entreprise_id,
      quart_id: quartId,
      employe_donneur_id: employe.id,
      employe_receveur_id: avecEmployeId,
      ...(partiel ? { heure_debut: heureDebut, heure_fin: heureFin } : {}),
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erreur création demande d'échange:", error);
    return NextResponse.json({ error: "La demande a échoué." }, { status: 500 });
  }

  await envoyerPushEmployes(
    service,
    [avecEmployeId],
    {
      titre: "Échange de quart",
      corps: `${employe.nom} t'a proposé un échange de quart.`,
      url: "/moi/demandes",
    },
    "notif_echange_recu"
  ).catch((err) => console.error("Erreur notification push:", err));

  return NextResponse.json({ demande });
}
