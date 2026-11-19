import { NextResponse } from "next/server";
import { lireJourneeWix } from "@/lib/ventesWix";
import { authentifierVentesWix, DATE_VALIDE } from "@/lib/ventesServer";

export const maxDuration = 60;

// Les transactions d'une journée, lues chez Wix à l'instant (rien n'est gardé chez Gozly).
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") || "";
  if (!DATE_VALIDE.test(date)) return NextResponse.json({ error: "Date invalide." }, { status: 400 });

  const { instanceId, lieu, erreur } = await authentifierVentesWix(request, params.get("entrepriseId"));
  if (erreur) return erreur;

  try {
    const { transactions, resume } = await lireJourneeWix(instanceId, date, lieu);
    return NextResponse.json({ transactions, resume });
  } catch (err) {
    console.error("Erreur lecture d'une journée de ventes Wix:", err.message);
    return NextResponse.json({ error: "La lecture des ventes chez Wix a échoué.", detail: err.message }, { status: 502 });
  }
}
