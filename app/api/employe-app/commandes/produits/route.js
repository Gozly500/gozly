import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";
import { lireProduitsTries } from "@/lib/ordreProduits";

// Produits de l'inventaire (nom, prix) pour construire une commande à la main
// depuis l'app employé : mêmes noms et mêmes prix que les commandes du site.
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  // Dans l'ordre choisi dans Inventaire > Produits (voir lib/ordreProduits.js), sinon alphabétique.
  const produits = await lireProduitsTries(
    (colonnes) => service.from("produits_inventaire").select(colonnes).eq("entreprise_id", employe.entreprise_id).order("nom", { ascending: true }).limit(1000),
    "id, nom, sku, prix, source, source_id"
  );

  return NextResponse.json({ produits });
}
