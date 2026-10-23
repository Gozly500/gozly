import { NextResponse } from "next/server";
import { appelSonos, contexteSonos, foyer, lireEtat, reponseErreurSonos } from "@/lib/sonosServer";

const ID = /^[A-Za-z0-9_.:\-]{1,80}$/;
const volumeValide = (v) => Number.isInteger(v) && v >= 0 && v <= 100;

// Commandes d'un groupe, qu'on peut aussi envoyer à tous les groupes d'un coup (« Partout »).
const ACTIONS_GROUPE = new Set(["lecture", "pause", "suivant", "precedent", "volumeGroupe", "muetGroupe", "favori", "playlist", "seek"]);

// Valide les paramètres d'une action de groupe ; retourne un message d'erreur ou null.
function erreurAction(c) {
  if ((c.action === "volumeGroupe") && !volumeValide(c.volume)) return "Volume invalide.";
  if (c.action === "favori" && !ID.test(String(c.favoriId || ""))) return "Favori invalide.";
  if (c.action === "playlist" && !ID.test(String(c.playlistId || ""))) return "Liste de lecture invalide.";
  // Se déplacer dans la chanson : position en millisecondes (au plus 24 h) ; itemId (facultatif) = la chanson en cours,
  // pour que Sonos refuse si la chanson vient de changer.
  if (c.action === "seek") {
    if (!Number.isInteger(c.positionMillis) || c.positionMillis < 0 || c.positionMillis > 86400000) return "Position invalide.";
    if (c.itemId !== undefined && c.itemId !== null && (typeof c.itemId !== "string" || c.itemId.length > 200)) return "Élément invalide.";
  }
  return null;
}

function commandeGroupe(appel, c, g) {
  switch (c.action) {
    case "lecture":
      return appel("POST", `/groups/${g}/playback/play`);
    case "pause":
      return appel("POST", `/groups/${g}/playback/pause`);
    case "suivant":
      return appel("POST", `/groups/${g}/playback/skipToNextTrack`);
    case "precedent":
      return appel("POST", `/groups/${g}/playback/skipToPreviousTrack`);
    case "seek":
      return appel("POST", `/groups/${g}/playback/seek`, { positionMillis: c.positionMillis, ...(c.itemId ? { itemId: c.itemId } : {}) });
    case "volumeGroupe":
      return appel("POST", `/groups/${g}/groupVolume`, { volume: c.volume });
    case "muetGroupe":
      return appel("POST", `/groups/${g}/groupVolume/mute`, { muted: !!c.muet });
    case "favori":
      return appel("POST", `/groups/${g}/favorites`, { favoriteId: c.favoriId, action: "REPLACE", playOnCompletion: true });
    case "playlist":
      return appel("POST", `/groups/${g}/playlists`, { playlistId: c.playlistId, action: "REPLACE", playOnCompletion: true });
  }
}

// Commandes envoyées au système Sonos : lecture, volume, favoris/playlists, composition des groupes.
//   { entrepriseId, action, groupeId?, partout?, joueurId?, volume?, muet?, favoriId?, playlistId? }
// `partout: true` envoie la commande de groupe à tous les groupes (sans les regrouper : pas parfaitement synchronisés).
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
  if (c.partout) {
    if (!ACTIONS_GROUPE.has(c.action)) return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
    const erreur = erreurAction(c);
    if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });
    const etat = await lireEtat(service, eid);
    if (!etat.ok) return reponseErreurSonos(etat);
    const resultats = await Promise.all(etat.data.groupes.map((grp) => commandeGroupe(appel, c, grp.id)));
    r = resultats.find((x) => !x.ok) || resultats[0] || { ok: true };
  } else if (ACTIONS_GROUPE.has(c.action)) {
    const erreur = erreurAction(c);
    if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });
    r = await commandeGroupe(appel, c, g);
  } else {
    switch (c.action) {
      case "volumeJoueur":
        if (!volumeValide(c.volume)) return NextResponse.json({ error: "Volume invalide." }, { status: 400 });
        r = await appel("POST", `/players/${c.joueurId}/playerVolume`, { volume: c.volume });
        break;
      case "muetJoueur":
        r = await appel("POST", `/players/${c.joueurId}/playerVolume/mute`, { muted: !!c.muet });
        break;
      case "retirerDuGroupe":
        // Le haut-parleur quitte le groupe (il devient un groupe à lui seul).
        r = await appel("POST", `/groups/${g}/groups/modifyGroupMembers`, { playerIdsToRemove: [c.joueurId] });
        break;
      case "creerGroupe": {
        const ids = Array.isArray(c.joueurIds) ? c.joueurIds.map(String) : [];
        if (ids.length < 2 || ids.length > 32 || !ids.every((x) => ID.test(x))) return NextResponse.json({ error: "Choisis au moins deux haut-parleurs." }, { status: 400 });
        const f = await foyer(service, eid);
        if (f.erreur) return reponseErreurSonos({ erreur: f.erreur, status: f.status });
        r = await appel("POST", `/households/${f.id}/groups/createGroup`, { playerIds: ids });
        break;
      }
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
  }

  if (!r.ok) return reponseErreurSonos(r);
  return NextResponse.json({ ok: true });
}
