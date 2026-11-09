import { NextResponse } from "next/server";
import { CORS, metadonneesServeur, origineDe } from "@/lib/iaOAuth";

export const dynamic = "force-dynamic";

// Découverte OAuth (RFC 8414) : les adresses d'autorisation, d'échange de jetons et d'inscription.
export async function GET(request) {
  return NextResponse.json(metadonneesServeur(origineDe(request)), { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
