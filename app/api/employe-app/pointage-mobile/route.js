import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { distanceMetres } from "@/lib/geocode";

const RAYON_MAX_METRES = 150;

// Résout, pour un employé donné, l'état de pointage mobile :
// - s'il a un pointage ouvert (sortie non posée), la succursale à
//   vérifier pour le fermer (celle du pointage, ou l'unique succursale
//   de l'entreprise si elle n'a pas été précisée - même comportement
//   implicite que le kiosque physique pour les entreprises à un seul
//   emplacement, voir PointageSection.jsx) ;
// - sinon, les succursales auxquelles il peut pointer une arrivée
//   (l'unique succursale de l'entreprise, ou celles auxquelles il est
//   explicitement assigné s'il y en a plusieurs).
// Dans les deux cas, seules les succursales avec une position GPS
// valide (adresse géocodée) comptent.
async function resoudreEtat(service, employe) {
  const { data: toutesEmplacements } = await service
    .from("emplacements")
    .select("id, nom, latitude, longitude")
    .eq("entreprise_id", employe.entreprise_id);

  const emplacements = toutesEmplacements || [];
  const uniqueEmplacement = emplacements.length === 1 ? emplacements[0] : null;

  const { data: enCours } = await service
    .from("pointages")
    .select("id, entree, emplacement_id")
    .eq("employe_id", employe.id)
    .is("sortie", null)
    .order("entree", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (enCours) {
    const emplacement = enCours.emplacement_id
      ? emplacements.find((e) => e.id === enCours.emplacement_id) || null
      : uniqueEmplacement;
    return {
      pointageOuvert: {
        entree: enCours.entree,
        gpsDisponible: !!(emplacement?.latitude != null && emplacement?.longitude != null),
        emplacementId: emplacement?.id || null,
        emplacementNom: emplacement?.nom || null,
      },
      aQuartAujourdhui: false,
      emplacementsEligibles: [],
      emplacements,
    };
  }

  let emplacementsEligibles;
  if (uniqueEmplacement) {
    emplacementsEligibles = [uniqueEmplacement];
  } else {
    const { data: associations } = await service
      .from("employe_emplacements")
      .select("emplacement_id")
      .eq("employe_id", employe.id);
    const idsAssignes = new Set((associations || []).map((a) => a.emplacement_id));
    emplacementsEligibles = emplacements.filter((e) => idsAssignes.has(e.id));
  }
  emplacementsEligibles = emplacementsEligibles.filter((e) => e.latitude != null && e.longitude != null);

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const { data: quarts } = await service
    .from("planning_quarts")
    .select("id")
    .eq("employe_id", employe.id)
    .eq("publie", true)
    .eq("date", aujourdhui)
    .limit(1);

  return {
    pointageOuvert: null,
    aQuartAujourdhui: (quarts || []).length > 0,
    emplacementsEligibles,
    emplacements,
  };
}

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();

  const { data: entreprise } = await service
    .from("entreprises")
    .select("pointage_mobile_actif")
    .eq("id", employe.entreprise_id)
    .maybeSingle();

  if (!entreprise?.pointage_mobile_actif) {
    return NextResponse.json({ actif: false });
  }

  const { pointageOuvert, aQuartAujourdhui, emplacementsEligibles } = await resoudreEtat(service, employe);

  return NextResponse.json({
    actif: true,
    pointageOuvert,
    aQuartAujourdhui,
    emplacements: emplacementsEligibles.map((e) => ({ id: e.id, nom: e.nom })),
  });
}

export async function POST(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { emplacementId, latitude, longitude } = await request.json();
  if (!emplacementId || typeof latitude !== "number" || typeof longitude !== "number") {
    return NextResponse.json({ error: "Position ou succursale manquante." }, { status: 400 });
  }

  const service = getServiceClient();

  const { data: entreprise } = await service
    .from("entreprises")
    .select("pointage_mobile_actif")
    .eq("id", employe.entreprise_id)
    .maybeSingle();

  if (!entreprise?.pointage_mobile_actif) {
    return NextResponse.json({ error: "Le pointage mobile n'est pas activé." }, { status: 403 });
  }

  const { pointageOuvert, emplacementsEligibles, emplacements } = await resoudreEtat(service, employe);

  // Détermine la succursale à vérifier : celle du pointage ouvert (si on
  // ferme un quart), sinon celle choisie parmi les succursales éligibles
  // (si on en commence un) - dans les deux cas, doit correspondre à ce
  // que le client a soumis.
  let emplacement = null;
  if (pointageOuvert) {
    if (!pointageOuvert.gpsDisponible || pointageOuvert.emplacementId !== emplacementId) {
      return NextResponse.json({ error: "Succursale invalide pour ce pointage." }, { status: 403 });
    }
    emplacement = emplacements.find((e) => e.id === emplacementId) || null;
  } else {
    emplacement = emplacementsEligibles.find((e) => e.id === emplacementId) || null;
  }
  if (!emplacement) {
    return NextResponse.json({ error: "Succursale invalide." }, { status: 403 });
  }

  const distance = distanceMetres(latitude, longitude, emplacement.latitude, emplacement.longitude);
  if (distance > RAYON_MAX_METRES) {
    return NextResponse.json(
      { error: `Tu sembles trop loin de ${emplacement.nom} pour pointer depuis l'app.` },
      { status: 400 }
    );
  }

  const maintenant = new Date().toISOString();
  let type;

  if (pointageOuvert) {
    const { data: ligneOuverte } = await service
      .from("pointages")
      .select("id")
      .eq("employe_id", employe.id)
      .is("sortie", null)
      .order("entree", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await service
      .from("pointages")
      .update({ sortie: maintenant, latitude, longitude })
      .eq("id", ligneOuverte.id);
    if (error) return NextResponse.json({ error: "Erreur : " + error.message }, { status: 500 });
    type = "depart";
  } else {
    const { error } = await service.from("pointages").insert({
      entreprise_id: employe.entreprise_id,
      employe_id: employe.id,
      entree: maintenant,
      emplacement_id: emplacementId,
      source: "mobile",
      latitude,
      longitude,
    });
    if (error) return NextResponse.json({ error: "Erreur : " + error.message }, { status: 500 });
    type = "arrivee";
  }

  return NextResponse.json({ type, heure: maintenant, emplacementNom: emplacement.nom });
}
