import { NextResponse } from "next/server";
import { cacheEtat as cache, configSonos, contexteSonos, lireEtat, reponseErreurSonos } from "@/lib/sonosServer";

// État du système : liaison, groupes, haut-parleurs, lecture en cours et volumes.
// Plusieurs écrans (tableau de bord, kiosques, app gestion) interrogent en même temps et chaque lecture coûte une dizaine d'appels
// à Sonos, qui limite le débit (429) : une même réponse est gardée quelques secondes par entreprise.
const DUREE_CACHE_MS = 3000; // le temps de la demande en cours
const DUREE_JOUE_MS = 12000; // quelque chose joue : réponse partagée 12 s
const DUREE_REPOS_MS = 40000; // tout est arrêté : 40 s
export async function GET(request) {
  const entrepriseId = new URL(request.url).searchParams.get("entrepriseId");
  const ctx = await contexteSonos(request, entrepriseId);
  if (ctx.reponse) return ctx.reponse;

  const configure = !!configSonos();
  const gardee = cache.get(ctx.entreprise.id);
  if (gardee && Date.now() - gardee.le < gardee.duree) {
    const r = await gardee.promesse;
    return NextResponse.json(r.corps, { status: r.status });
  }
  const promesse = lire(ctx, configure);
  const entree = { le: Date.now(), promesse, duree: DUREE_CACHE_MS };
  cache.set(ctx.entreprise.id, entree);
  const r = await promesse;
  const joue = (r.corps?.groupes || []).some((g) => g.etat === "PLAYING" || g.etat === "BUFFERING");
  entree.le = Date.now();
  entree.duree = r.status === 429 ? 30000 : joue ? DUREE_JOUE_MS : DUREE_REPOS_MS;
  // Une erreur n'est pas gardée : le prochain appel réessaie vraiment (sauf « trop de demandes », qu'on laisse souffler).
  if (r.status >= 400 && r.status !== 429) cache.delete(ctx.entreprise.id);
  return NextResponse.json(r.corps, { status: r.status });
}

async function lire(ctx, configure) {
  const { data: connexion } = await ctx.service.from("sonos_connexions").select("entreprise_id, refresh_token").eq("entreprise_id", ctx.entreprise.id).maybeSingle();
  if (!connexion?.refresh_token) return { corps: { configure, lie: false }, status: 200 };

  const r = await lireEtat(ctx.service, ctx.entreprise.id);
  if (!r.ok) {
    if (r.erreur === "expire") return { corps: { configure, lie: true, expire: true }, status: 200 };
    const rep = reponseErreurSonos(r);
    return { corps: await rep.json(), status: rep.status };
  }
  return { corps: { configure, lie: true, ...r.data }, status: 200 };
}
