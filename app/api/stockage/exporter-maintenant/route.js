import { NextResponse } from "next/server";
import { authentifierStockage } from "@/lib/stockageServer";
import { exporterMaintenant } from "@/lib/exportsStockage";

// Dépose tout de suite les fiches de température des 30 derniers jours dans le stockage connecté (OneDrive ou Google Drive).
export async function POST(request) {
  const { entrepriseId, fournisseur } = await request.json().catch(() => ({}));
  const { service, entreprise, erreur } = await authentifierStockage(request, entrepriseId);
  if (erreur) return erreur;

  const { data: connexion } = await service
    .from("stockage_connexions")
    .select("*")
    .eq("entreprise_id", entreprise.id)
    .eq("fournisseur", fournisseur || "microsoft")
    .maybeSingle();
  if (!connexion || connexion.statut !== "connecte") {
    return NextResponse.json({ error: "Le stockage n'est pas connecté." }, { status: 400 });
  }

  const resultat = await exporterMaintenant(service, connexion);
  if (resultat.erreur) return NextResponse.json({ error: resultat.erreur }, { status: 502 });
  return NextResponse.json(resultat);
}
