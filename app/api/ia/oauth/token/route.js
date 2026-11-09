import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { CORS, echangerCode, renouveler } from "@/lib/iaOAuth";

export const dynamic = "force-dynamic";

const ENTETES = { ...CORS, "Cache-Control": "no-store", Pragma: "no-cache" };

function erreur(code, description, status = 400) {
  return NextResponse.json({ error: code, error_description: description }, { status, headers: ENTETES });
}

// Échange un code d'autorisation (ou un jeton de renouvellement) contre des jetons d'accès. Corps : formulaire (norme) ou JSON.
export async function POST(request) {
  const service = getServiceClient();
  if (!service) return erreur("server_error", "Service indisponible.", 503);

  const texte = await request.text().catch(() => "");
  let p = {};
  if ((request.headers.get("content-type") || "").includes("json")) {
    try {
      p = JSON.parse(texte) || {};
    } catch {
      return erreur("invalid_request", "JSON invalide.");
    }
  } else {
    p = Object.fromEntries(new URLSearchParams(texte));
  }

  let r;
  if (p.grant_type === "authorization_code") {
    r = await echangerCode(service, { code: p.code, clientId: p.client_id, redirectUri: p.redirect_uri, codeVerifier: p.code_verifier });
  } else if (p.grant_type === "refresh_token") {
    r = await renouveler(service, { refreshToken: p.refresh_token, clientId: p.client_id });
  } else {
    return erreur("unsupported_grant_type", "Type de demande non supporté.");
  }

  if (r.erreur) return erreur(r.erreur, r.description, r.erreur === "invalid_client" ? 401 : r.erreur === "server_error" ? 500 : 400);
  return NextResponse.json(r.jetons, { headers: ENTETES });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
