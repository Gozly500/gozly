import { NextResponse } from "next/server";
import { appelSonos, contexteSonos, foyer, reponseErreurSonos } from "@/lib/sonosServer";

// Favoris et listes de lecture (playlists) Sonos du client, à lancer dans un groupe.
export async function GET(request) {
  const entrepriseId = new URL(request.url).searchParams.get("entrepriseId");
  const ctx = await contexteSonos(request, entrepriseId);
  if (ctx.reponse) return ctx.reponse;

  const f = await foyer(ctx.service, ctx.entreprise.id);
  if (f.erreur) return reponseErreurSonos({ erreur: f.erreur, status: f.status });

  const [fav, pl] = await Promise.all([
    appelSonos(ctx.service, ctx.entreprise.id, "GET", `/households/${f.id}/favorites`),
    appelSonos(ctx.service, ctx.entreprise.id, "GET", `/households/${f.id}/playlists`),
  ]);
  if (!fav.ok && !pl.ok) return reponseErreurSonos(fav);

  const itemsFav = fav.data?.items || fav.data?.favoriteList?.items || [];
  return NextResponse.json({
    favoris: itemsFav.map((x) => ({ id: x.id, nom: x.name, description: x.description || "", image: x.imageUrl || null })),
    playlists: (pl.data?.playlists || []).map((x) => ({ id: x.id, nom: x.name, pistes: x.trackCount ?? null })),
  });
}
