import { NextResponse } from "next/server";
import { contexteSonos, oublierEtat } from "@/lib/sonosServer";

// Délie le compte Sonos : les jetons sont effacés (le client peut aussi révoquer l'accès dans son compte Sonos).
// La ligne reste, avec le numéro du système Sonos (household) : à la reconnexion, Gozly n'a pas à le redemander à Sonos
// (cet appel est limité et un 429 laissait le client devant une page vide).
export async function POST(request) {
  const { entrepriseId } = await request.json().catch(() => ({}));
  const ctx = await contexteSonos(request, entrepriseId);
  if (ctx.reponse) return ctx.reponse;
  oublierEtat(ctx.entreprise.id);
  const { error } = await ctx.service
    .from("sonos_connexions")
    .update({ access_token: "", refresh_token: "", expires_at: new Date().toISOString(), maj: new Date().toISOString() })
    .eq("entreprise_id", ctx.entreprise.id);
  if (error) return NextResponse.json({ error: "La déconnexion a échoué." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
