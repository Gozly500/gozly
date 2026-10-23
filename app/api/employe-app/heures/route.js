import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { bornesJour, decalerJour } from "@/lib/commandes";
import { heuresPointees } from "@/lib/heuresPointees";

// Heures réellement pointées de l'employé connecté (arrivée / départ), jour par jour, pour la semaine demandée.
// Lecture seule, et seulement ses propres pointages.
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) return NextResponse.json({ error: "Session invalide." }, { status: 401 });

  const semaine = new URL(request.url).searchParams.get("semaine");
  if (!semaine || !/^\d{4}-\d{2}-\d{2}$/.test(semaine)) return NextResponse.json({ error: "Semaine manquante." }, { status: 400 });

  const finSemaine = decalerJour(semaine, 7);
  const { debut: debutISO } = bornesJour(semaine);
  const { debut: finISO } = bornesJour(finSemaine);
  const service = getServiceClient();

  const [{ data: pointages }, { data: entreprise }] = await Promise.all([
    service.from("pointages").select("entree, sortie").eq("employe_id", employe.id).gte("entree", debutISO).lt("entree", finISO).order("entree", { ascending: true }),
    service.from("entreprises").select("pointage_calcul_mode").eq("id", employe.entreprise_id).maybeSingle(),
  ]);

  const modeCalcul = entreprise?.pointage_calcul_mode === "horaire" ? "horaire" : "reel";
  // Les quarts ne servent que dans le mode « horaire » (heure prévue si l'employé pointe en avance).
  let quarts = [];
  if (modeCalcul === "horaire") {
    const { data } = await service.from("planning_quarts").select("date, heure_debut").eq("employe_id", employe.id).gte("date", semaine).lt("date", finSemaine);
    quarts = data || [];
  }

  return NextResponse.json({ ...heuresPointees({ pointages: pointages || [], quarts, modeCalcul }), aDesPointages: (pointages || []).length > 0 });
}
