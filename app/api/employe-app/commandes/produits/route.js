import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

// Produits de l'inventaire (nom, prix) pour construire une commande à la main
// depuis l'app employé : mêmes noms et mêmes prix que les commandes du site.
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const { data: produits } = await service
    .from("produits_inventaire")
    .select("id, nom, sku, prix, source, source_id")
    .eq("entreprise_id", employe.entreprise_id)
    .order("nom", { ascending: true })
    .limit(1000);

  return NextResponse.json({ produits: produits || [] });
}
