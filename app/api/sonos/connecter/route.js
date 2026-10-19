import { NextResponse } from "next/server";
import { configSonos, contexteSonos, creerState, lienAutorisation } from "@/lib/sonosServer";

// Début de la liaison : retourne l'adresse Sonos où le client se connecte et autorise Gozly.
export async function POST(request) {
  const { entrepriseId } = await request.json().catch(() => ({}));
  const ctx = await contexteSonos(request, entrepriseId);
  if (ctx.reponse) return ctx.reponse;
  if (!configSonos()) {
    return NextResponse.json({ error: "La liaison avec Sonos n'est pas encore configurée.", code: "non-configure" }, { status: 501 });
  }
  return NextResponse.json({ url: lienAutorisation(request, creerState(ctx.entreprise.id, ctx.user.id)) });
}
