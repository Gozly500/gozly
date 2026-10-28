import { NextResponse } from "next/server";
import { authentifierStockage } from "@/lib/stockageServer";
import { DOSSIER_DOCUMENTS, accesNuage, connexionPourNuage } from "@/lib/fichiersStockage";

// Renvoie le contenu (octets bruts) d'un document du dossier « Gozly > Documents ».
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const entrepriseId = params.get("entrepriseId");
  const id = params.get("id");
  if (!id) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });

  const { service, entreprise, erreur } = await authentifierStockage(request, entrepriseId);
  if (erreur) return erreur;
  const { connexion, erreur: pasConnecte } = await connexionPourNuage(service, entreprise.id, params.get("fournisseur"));
  if (pasConnecte) return pasConnecte;
  const acces = await accesNuage(service, connexion);
  if (acces.erreur) return acces.erreur;

  try {
    const octets = await acces.lib.lireFichier(acces.accessToken, DOSSIER_DOCUMENTS, id);
    return new Response(octets, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Lecture d'un document du nuage:", err);
    return NextResponse.json({ error: err?.message?.includes("dossier Gozly") ? err.message : `Impossible d'ouvrir ce fichier dans ${acces.nom}.` }, { status: 502 });
  }
}
