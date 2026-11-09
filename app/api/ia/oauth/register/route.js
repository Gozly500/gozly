import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { CORS, enregistrerClient } from "@/lib/iaOAuth";

export const dynamic = "force-dynamic";

// Inscription dynamique d'un assistant IA (RFC 7591). Aucun secret : l'assistant est un client public et la sécurité vient
// de la page d'autorisation (le propriétaire doit se connecter à Gozly et cliquer « Autoriser ») et de PKCE.
export async function POST(request) {
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "server_error" }, { status: 503, headers: CORS });

  const corps = await request.json().catch(() => null);
  if (!corps) return NextResponse.json({ error: "invalid_client_metadata", error_description: "JSON invalide." }, { status: 400, headers: CORS });

  const { client, erreur, description } = await enregistrerClient(service, corps);
  if (erreur) return NextResponse.json({ error: erreur, error_description: description }, { status: erreur === "server_error" ? 500 : 400, headers: CORS });

  return NextResponse.json(
    {
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201, headers: CORS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
