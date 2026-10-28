import { NextResponse } from "next/server";
import { authentifierStockage } from "@/lib/stockageServer";

// Oublie la connexion : les fichiers déjà déposés chez le client restent chez lui.
export async function POST(request) {
  const { entrepriseId, fournisseur } = await request.json().catch(() => ({}));
  const { service, entreprise, erreur } = await authentifierStockage(request, entrepriseId);
  if (erreur) return erreur;

  const { error } = await service.from("stockage_connexions").delete().eq("entreprise_id", entreprise.id).eq("fournisseur", fournisseur);
  if (error) {
    console.error("Erreur déconnexion stockage:", error);
    return NextResponse.json({ error: "La déconnexion a échoué." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
