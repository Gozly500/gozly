import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { aAuMoinsUnDroit, normaliserDroits } from "@/lib/iaModules";
import { challengeValide, chargerClient, construireRedirection, creerCode } from "@/lib/iaOAuth";

export const dynamic = "force-dynamic";

// Appelé par la page /connexion-ia (le propriétaire est connecté à Gozly). Actions : infos | autoriser | refuser.
// Sécurité : l'adresse de retour doit être EXACTEMENT une de celles que l'assistant a enregistrées, et seul le PROPRIÉTAIRE
// d'une entreprise peut y brancher un assistant.
export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const corps = await request.json().catch(() => ({}));
  const { action, client_id, redirect_uri, code_challenge, code_challenge_method, state, entrepriseId } = corps;

  const supabase = getSupabaseForToken(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });

  const client = await chargerClient(service, client_id);
  if (!client || !client.redirect_uris.includes(redirect_uri)) {
    return NextResponse.json({ error: "Cette demande de connexion est invalide. Reviens dans ton assistant et réessaie." }, { status: 400 });
  }

  if (action === "refuser") {
    return NextResponse.json({ redirect: construireRedirection(redirect_uri, { error: "access_denied", state }) });
  }

  // Les entreprises dont cette personne est propriétaire.
  const { data: liens } = await service.from("membres").select("entreprise_id").eq("user_id", user.id).eq("role", "proprietaire");
  const ids = (liens || []).map((l) => l.entreprise_id);
  const { data: entreprises } = ids.length ? await service.from("entreprises").select("id, nom").in("id", ids) : { data: [] };

  if (action === "infos") {
    return NextResponse.json({
      client_nom: client.client_nom,
      redirect_hote: new URL(redirect_uri).host,
      entreprises: (entreprises || []).map((e) => ({ id: e.id, nom: e.nom })),
    });
  }

  if (action === "autoriser") {
    if (!challengeValide(code_challenge) || code_challenge_method !== "S256") {
      return NextResponse.json({ error: "Cet assistant n'envoie pas la protection PKCE (S256) requise." }, { status: 400 });
    }
    const droits = normaliserDroits(corps.droits);
    if (!aAuMoinsUnDroit(droits)) {
      return NextResponse.json({ error: "Choisis au moins un module auquel l'assistant aura accès." }, { status: 400 });
    }
    if (!(entreprises || []).some((e) => e.id === entrepriseId)) {
      return NextResponse.json({ error: "Seul le propriétaire de l'entreprise peut y brancher un assistant." }, { status: 403 });
    }
    const code = await creerCode(service, {
      clientId: client.client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      entrepriseId,
      userId: user.id,
      droits,
    });
    if (!code) return NextResponse.json({ error: "Impossible de créer l'autorisation. Le SQL des connexions IA (OAuth) a-t-il été exécuté?" }, { status: 500 });
    return NextResponse.json({ redirect: construireRedirection(redirect_uri, { code, state }) });
  }

  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}
