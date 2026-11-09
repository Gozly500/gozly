import { NextResponse } from "next/server";
import { CORS, metadonneesServeur, origineDe } from "@/lib/iaOAuth";

export const dynamic = "force-dynamic";

// Même contenu que oauth-authorization-server : certains assistants cherchent la découverte à cette adresse.
export async function GET(request) {
  return NextResponse.json(metadonneesServeur(origineDe(request)), { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
