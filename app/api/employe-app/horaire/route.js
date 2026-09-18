import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const semaine = searchParams.get("semaine");
  if (!semaine) {
    return NextResponse.json({ error: "Semaine manquante." }, { status: 400 });
  }

  const debut = new Date(semaine);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + 7);
  const finISO = fin.toISOString().slice(0, 10);

  const service = getServiceClient();
  const { data: quarts } = await service
    .from("planning_quarts")
    .select("id, date, heure_debut, heure_fin, poste, emplacement_id")
    .eq("employe_id", employe.id)
    .eq("publie", true)
    .gte("date", semaine)
    .lt("date", finISO)
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  if (!quarts || quarts.length === 0) {
    return NextResponse.json({ quarts: [] });
  }

  // Détails du bouton "Afficher" : nom de la succursale, et collègues dont
  // le quart publié chevauche celui-ci (même succursale quand le quart en a une).
  const [{ data: emplacements }, { data: autres }] = await Promise.all([
    service.from("emplacements").select("id, nom").eq("entreprise_id", employe.entreprise_id),
    service
      .from("planning_quarts")
      .select("date, heure_debut, heure_fin, poste, emplacement_id, employes(nom)")
      .eq("entreprise_id", employe.entreprise_id)
      .eq("publie", true)
      .neq("employe_id", employe.id)
      .gte("date", semaine)
      .lt("date", finISO),
  ]);

  const nomsEmplacements = new Map((emplacements || []).map((e) => [e.id, e.nom]));

  const enrichis = quarts.map((q) => ({
    id: q.id,
    date: q.date,
    heure_debut: q.heure_debut,
    heure_fin: q.heure_fin,
    poste: q.poste || null,
    emplacement_nom: nomsEmplacements.get(q.emplacement_id) || null,
    collegues: (autres || [])
      .filter(
        (a) =>
          a.date === q.date &&
          (!q.emplacement_id || a.emplacement_id === q.emplacement_id) &&
          a.heure_debut < q.heure_fin &&
          a.heure_fin > q.heure_debut
      )
      .map((a) => ({
        nom: a.employes?.nom || "Collègue",
        heure_debut: a.heure_debut,
        heure_fin: a.heure_fin,
        poste: a.poste || null,
      }))
      .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut) || a.nom.localeCompare(b.nom)),
  }));

  return NextResponse.json({ quarts: enrichis });
}
