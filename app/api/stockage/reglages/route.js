import { NextResponse } from "next/server";
import { authentifierStockage } from "@/lib/stockageServer";

const FREQUENCES = ["aucun", "hebdo", "mensuel"];

// Fréquence de l'export automatique des fiches de température vers le stockage en ligne.
export async function POST(request) {
  const { entrepriseId, fournisseur, exportTemperatures } = await request.json().catch(() => ({}));
  if (fournisseur !== "microsoft" || !FREQUENCES.includes(exportTemperatures)) {
    return NextResponse.json({ error: "Réglage invalide." }, { status: 400 });
  }

  const { service, entreprise, erreur } = await authentifierStockage(request, entrepriseId);
  if (erreur) return erreur;

  const { error } = await service
    .from("stockage_connexions")
    .update({ export_temperatures: exportTemperatures, updated_at: new Date().toISOString() })
    .eq("entreprise_id", entreprise.id)
    .eq("fournisseur", fournisseur);

  if (error) {
    console.error("Erreur réglage stockage:", error);
    return NextResponse.json({ error: "L'enregistrement a échoué." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
