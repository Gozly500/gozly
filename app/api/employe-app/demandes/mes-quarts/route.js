import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

// Tous les quarts publiés à venir de l'employé (pas juste ceux de la
// semaine courante, contrairement à /api/employe-app/horaire) - utilisé
// pour choisir quel quart proposer en échange, voir DemandesEmploye.jsx.
// Un employé doit pouvoir échanger n'importe quel quart déjà sorti, pas
// seulement ceux de la semaine affichée.
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const { data: quarts } = await service
    .from("planning_quarts")
    .select("id, date, heure_debut, heure_fin, poste")
    .eq("employe_id", employe.id)
    .eq("publie", true)
    .gte("date", aujourdhui)
    .order("date", { ascending: true })
    .order("heure_debut", { ascending: true });

  return NextResponse.json({ quarts: quarts || [] });
}
