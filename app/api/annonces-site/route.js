import { NextResponse } from "next/server";
import { annoncesPubliees } from "@/lib/annoncesSite";

export const dynamic = "force-dynamic";

// Public : les annonces PUBLIQUES de Gozly (page /annonces, bandeau du tableau de bord), les plus récentes d'abord.
// ?limit=1 pour le bandeau. (À ne pas confondre avec /api/annonces : les annonces d'équipe d'une entreprise.)
export async function GET(request) {
  const limite = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("limit") || "20", 10) || 20, 1), 50);
  const { annonces, erreur } = await annoncesPubliees(limite);
  return NextResponse.json({ annonces, erreur }, { headers: { "Cache-Control": "no-store" } });
}
