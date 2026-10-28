import { NextResponse } from "next/server";
import { authentifierStockage } from "@/lib/stockageServer";

// État des connexions de stockage de l'entreprise (jamais les jetons).
export async function GET(request) {
  const entrepriseId = new URL(request.url).searchParams.get("entrepriseId");
  const { service, entreprise, erreur } = await authentifierStockage(request, entrepriseId);
  if (erreur) return erreur;

  const { data } = await service
    .from("stockage_connexions")
    .select("fournisseur, compte_email, statut, export_temperatures, dernier_export_temperatures, derniere_erreur")
    .eq("entreprise_id", entreprise.id);

  const connexions = {};
  for (const c of data || []) {
    connexions[c.fournisseur] = {
      email: c.compte_email,
      statut: c.statut,
      exportTemperatures: c.export_temperatures,
      dernierExport: c.dernier_export_temperatures,
      erreur: c.derniere_erreur,
    };
  }
  return NextResponse.json({ connexions });
}
