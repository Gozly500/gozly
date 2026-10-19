import { NextResponse } from "next/server";
import { appelSonos, contexteSonos, foyer, lireEtat, reponseErreurSonos } from "@/lib/sonosServer";

const ID = /^[A-Za-z0-9_.:\-]{1,80}$/;
const volumeValide = (v) => Number.isInteger(v) && v >= 0 && v <= 100;

// Commandes envoyées au système Sonos : lecture, volume, favoris/playlists, composition des groupes.
//   { entrepriseId, action, groupeId?, joueurId?, volume?, favoriId?, playlistId? }
export async function POST(request) {
  const c = await request.json().catch(() => ({}));
  const ctx = await contexteSonos(request, c.entrepriseId);
  if (ctx.reponse) return ctx.reponse;
  const { service, entreprise } = ctx;
  const eid = entreprise.id;
  const appel = (methode, chemin, corps) => appelSonos(service, eid, methode, chemin, corps);

  if (c.groupeId !== undefined && !ID.test(String(c.groupeId))) return NextResponse.json({ error: "Groupe invalide." }, { status: 400 });
  if (c.joueurId !== undefined && !ID.test(String(c.joueurId))) return NextResponse.json({ error: "Haut-parleur invalide." }, { status: 400 });
  const g = c.groupeId;

  let r;
  switch (c.action) {
    case "lecture":
      r = await appel("POST", `/groups/${g}/playback/play`);
      break;
    case "pause":
      r = await appel("POST", `/groups/${g}/playback/pause`);
      break;
    case "suivant":
      r = await appel("POST", `/groups/${g}/playback/skipToNextTrack`);
      break;
    case "precedent":
      r = await appel("POST", `/groups/${g}/playback/skipToPreviousTrack`);
      break;
    case "volumeGroupe":
      if (!volumeValide(c.volume)) return NextResponse.json({ error: "Volume invalide." }, { status: 400 });
      r = await appel("POST", `/groups/${g}/groupVolume`, { volume: c.volume });
      break;
    case "volumeJoueur":
      if (!volumeValide(c.volume)) return NextResponse.json({ error: "Volume invalide." }, { status: 400 });
      r = await appel("POST", `/players/${c.joueurId}/playerVolume`, { volume: c.volume });
      break;
    case "favori":
      if (!ID.test(String(c.favoriId || ""))) return NextResponse.json({ error: "Favori invalide." }, { status: 400 });
      r = await appel("POST", `/groups/${g}/favorites`, { favoriteId: c.favoriId, action: "REPLACE", playOnCompletion: true });
      break;
    case "playlist":
      if (!ID.test(String(c.playlistId || ""))) return NextResponse.json({ error: "Liste de lecture invalide." }, { status: 400 });
      r = await appel("POST", `/groups/${g}/playlists`, { playlistId: c.playlistId, action: "REPLACE", playOnCompletion: true });
      break;
    case "ajouterAuGroupe":
      r = await appel("POST", `/groups/${g}/groups/modifyGroupMembers`, { playerIdsToAdd: [c.joueurId] });
      break;
    case "separer": {
      // Le haut-parleur quitte son groupe et forme le sien (il pourra jouer une autre musique).
      const f = await foyer(service, eid);
      if (f.erreur) return reponseErreurSonos({ erreur: f.erreur, status: f.status });
      r = await appel("POST", `/households/${f.id}/groups/createGroup`, { playerIds: [c.joueurId] });
      break;
    }
    case "toutPause":
    case "toutVolume": {
      // Tous les groupes à la fois.
      if (c.action === "toutVolume" && !volumeValide(c.volume)) return NextResponse.json({ error: "Volume invalide." }, { status: 400 });
      const etat = await lireEtat(service, eid);
      if (!etat.ok) return reponseErreurSonos(etat);
      const resultats = await Promise.all(
        etat.data.groupes.map((grp) =>
          c.action === "toutPause" ? appel("POST", `/groups/${grp.id}/playback/pause`) : appel("POST", `/groups/${grp.id}/groupVolume`, { volume: c.volume })
        )
      );
      r = resultats.find((x) => !x.ok) || resultats[0] || { ok: true };
      break;
    }
    default:
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }

  if (!r.ok) return reponseErreurSonos(r);
  return NextResponse.json({ ok: true });
}
