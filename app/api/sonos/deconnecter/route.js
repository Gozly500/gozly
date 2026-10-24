import { NextResponse } from "next/server";
import { contexteSonos, oublierEtat } from "@/lib/sonosServer";

// Délie le compte Sonos : les jetons sont supprimés (le client peut aussi révoquer l'accès dans son compte Sonos).
export async function POST(request) {
  const { entrepriseId } = await request.json().catch(() => ({}));
  const ctx = await contexteSonos(request, entrepriseId);
  if (ctx.reponse) return ctx.reponse;
  oublierEtat(ctx.entreprise.id);
  const { error } = await ctx.service.from("sonos_connexions").delete().eq("entreprise_id", ctx.entreprise.id);
  if (error) return NextResponse.json({ error: "La déconnexion a échoué." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
