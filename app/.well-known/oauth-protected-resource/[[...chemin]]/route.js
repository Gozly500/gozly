import { NextResponse } from "next/server";
import { CORS, metadonneesRessource, origineDe } from "@/lib/iaOAuth";

export const dynamic = "force-dynamic";

// Découverte OAuth (RFC 9728) : dit à l'assistant IA quel serveur d'autorisation protège /api/ia/mcp.
export async function GET(request) {
  return NextResponse.json(metadonneesRessource(origineDe(request)), { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
