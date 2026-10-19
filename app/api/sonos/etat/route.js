import { NextResponse } from "next/server";
import { configSonos, contexteSonos, lireEtat, reponseErreurSonos } from "@/lib/sonosServer";

// État du système : liaison, groupes, haut-parleurs, lecture en cours et volumes.
export async function GET(request) {
  const entrepriseId = new URL(request.url).searchParams.get("entrepriseId");
  const ctx = await contexteSonos(request, entrepriseId);
  if (ctx.reponse) return ctx.reponse;

  const configure = !!configSonos();
  const { data: connexion } = await ctx.service.from("sonos_connexions").select("entreprise_id").eq("entreprise_id", ctx.entreprise.id).maybeSingle();
  if (!connexion) return NextResponse.json({ configure, lie: false });

  const r = await lireEtat(ctx.service, ctx.entreprise.id);
  if (!r.ok) {
    if (r.erreur === "expire") return NextResponse.json({ configure, lie: true, expire: true });
    return reponseErreurSonos(r);
  }
  return NextResponse.json({ configure, lie: true, ...r.data });
}
