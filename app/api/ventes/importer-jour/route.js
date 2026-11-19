import { NextResponse } from "next/server";
import { importerJourneeWix } from "@/lib/ventesWix";
import { authentifierVentesWix, DATE_VALIDE } from "@/lib/ventesServer";

// Une journée de point de vente peut demander plusieurs pages de résultats chez Wix.
export const maxDuration = 60;

// Importe UNE journée de ventes Wix (en ligne + comptoir) : garde le résumé dans `ventes_jours`, pas les transactions.
export async function POST(request) {
  const { entrepriseId, date } = await request.json().catch(() => ({}));
  if (!DATE_VALIDE.test(String(date || ""))) return NextResponse.json({ error: "Date invalide." }, { status: 400 });

  const { service, entreprise, instanceId, lieu, erreur } = await authentifierVentesWix(request, entrepriseId);
  if (erreur) return erreur;

  try {
    const jour = await importerJourneeWix(service, entreprise.id, instanceId, date, lieu);
    return NextResponse.json({ ok: true, jour });
  } catch (err) {
    console.error("Erreur import d'une journée de ventes Wix:", err.message);
    return NextResponse.json({ error: "L'import de la journée a échoué.", detail: err.message }, { status: 502 });
  }
}
