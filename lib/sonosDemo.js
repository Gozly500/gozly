// Mode démonstration de la page Musique (/dashboard/musique?demo=1) : faux haut-parleurs, aucune requête à Sonos.
// Sert à voir et essayer la page sans compte Sonos.
export const CONTENU_DEMO = {
  favoris: [
    { id: "f1", nom: "Jazz de brunch" },
    { id: "f2", nom: "Radio lounge" },
    { id: "f3", nom: "Succès des années 80" },
  ],
  playlists: [
    { id: "l1", nom: "Ambiance du midi" },
    { id: "l2", nom: "Soirée terrasse" },
  ],
};

export function etatDemo() {
  return {
    configure: true,
    lie: true,
    groupes: [
      {
        id: "g1",
        nom: "Salle à manger",
        etat: "PLAYING",
        volume: 32,
        titre: "Fly Me to the Moon",
        artiste: "Frank Sinatra",
        image: null,
        joueurs: [
          { id: "p1", nom: "Salle avant", volume: 30 },
          { id: "p2", nom: "Salle arrière", volume: 35 },
        ],
      },
      { id: "g2", nom: "Terrasse", etat: "PAUSED", volume: 20, titre: null, artiste: null, image: null, joueurs: [{ id: "p3", nom: "Terrasse", volume: 20 }] },
      { id: "g3", nom: "Cuisine", etat: "IDLE", volume: 15, titre: null, artiste: null, image: null, joueurs: [{ id: "p4", nom: "Cuisine", volume: 15 }] },
    ],
  };
}

// Applique une commande à l'état de démonstration (retourne un nouvel état).
export function appliquerDemo(etat, c) {
  const groupes = etat.groupes.map((g) => ({ ...g, joueurs: g.joueurs.map((j) => ({ ...j })) }));
  const groupe = groupes.find((g) => g.id === c.groupeId);
  const pistes = [["Fly Me to the Moon", "Frank Sinatra"], ["Take Five", "Dave Brubeck"], ["La vie en rose", "Édith Piaf"], ["Feeling Good", "Nina Simone"]];
  const piste = (g, delta) => {
    const i = Math.max(0, pistes.findIndex((p) => p[0] === g.titre));
    const p = pistes[(i + delta + pistes.length) % pistes.length];
    g.titre = p[0];
    g.artiste = p[1];
  };

  switch (c.action) {
    case "lecture":
      groupe.etat = "PLAYING";
      if (!groupe.titre) piste(groupe, 0);
      break;
    case "pause":
      groupe.etat = "PAUSED";
      break;
    case "suivant":
      piste(groupe, 1);
      break;
    case "precedent":
      piste(groupe, -1);
      break;
    case "volumeGroupe":
      groupe.volume = c.volume;
      groupe.joueurs.forEach((j) => (j.volume = c.volume));
      break;
    case "volumeJoueur":
      groupes.forEach((g) => g.joueurs.forEach((j) => j.id === c.joueurId && (j.volume = c.volume)));
      break;
    case "favori":
    case "playlist": {
      const nom = [...CONTENU_DEMO.favoris, ...CONTENU_DEMO.playlists].find((x) => x.id === (c.favoriId || c.playlistId))?.nom;
      groupe.etat = "PLAYING";
      groupe.titre = nom || "Musique";
      groupe.artiste = null;
      break;
    }
    case "toutPause":
      groupes.forEach((g) => (g.etat = "PAUSED"));
      break;
    case "toutVolume":
      groupes.forEach((g) => {
        g.volume = c.volume;
        g.joueurs.forEach((j) => (j.volume = c.volume));
      });
      break;
    case "separer": {
      const source = groupes.find((g) => g.joueurs.some((j) => j.id === c.joueurId));
      const joueur = source.joueurs.find((j) => j.id === c.joueurId);
      source.joueurs = source.joueurs.filter((j) => j.id !== c.joueurId);
      groupes.push({ id: "n" + c.joueurId, nom: joueur.nom, etat: "IDLE", volume: joueur.volume, titre: null, artiste: null, image: null, joueurs: [joueur] });
      break;
    }
    case "ajouterAuGroupe": {
      const source = groupes.find((g) => g.joueurs.some((j) => j.id === c.joueurId));
      const joueur = source.joueurs.find((j) => j.id === c.joueurId);
      source.joueurs = source.joueurs.filter((j) => j.id !== c.joueurId);
      groupe.joueurs.push(joueur);
      break;
    }
  }
  return { ...etat, groupes: groupes.filter((g) => g.joueurs.length > 0) };
}
