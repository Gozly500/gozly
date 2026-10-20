// Simulation locale de la page Musique : sert au mode démonstration (/dashboard/musique?demo=1, faux
// haut-parleurs, aucune requête à Sonos) et à l'affichage immédiat des réglages simples (volume, muet,
// lecture) pendant que la vraie commande part vers Sonos.
export const CONTENU_DEMO = {
  favoris: [
    { id: "f1", nom: "Jazz de brunch", service: "Spotify" },
    { id: "f2", nom: "Chill du midi", service: "Spotify" },
    { id: "f3", nom: "Top 50 Canada", service: "Spotify" },
    { id: "f4", nom: "Lounge Café", service: "Apple Music" },
    { id: "f5", nom: "Succès des années 80", service: "Apple Music" },
    { id: "f6", nom: "Ici Musique Classique", service: "Radio" },
    { id: "f7", nom: "CHOM 97.7", service: "Radio" },
  ],
  playlists: [
    { id: "l1", nom: "Ambiance du midi", pistes: 42 },
    { id: "l2", nom: "Soirée terrasse", pistes: 28 },
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
        muet: false,
        titre: "Fly Me to the Moon",
        artiste: "Frank Sinatra",
        image: null,
        joueurs: [
          { id: "p1", nom: "Salle avant", volume: 30, muet: false },
          { id: "p2", nom: "Salle arrière", volume: 35, muet: false },
        ],
      },
      { id: "g2", nom: "Terrasse", etat: "PAUSED", volume: 20, muet: false, titre: null, artiste: null, image: null, joueurs: [{ id: "p3", nom: "Terrasse", volume: 20, muet: false }] },
      { id: "g3", nom: "Cuisine", etat: "IDLE", volume: 15, muet: false, titre: null, artiste: null, image: null, joueurs: [{ id: "p4", nom: "Cuisine", volume: 15, muet: false }] },
      { id: "g4", nom: "Bar", etat: "IDLE", volume: 25, muet: true, titre: null, artiste: null, image: null, joueurs: [{ id: "p5", nom: "Bar", volume: 25, muet: true }] },
    ],
  };
}

const PISTES = [
  ["Fly Me to the Moon", "Frank Sinatra"],
  ["Take Five", "Dave Brubeck"],
  ["La vie en rose", "Édith Piaf"],
  ["Feeling Good", "Nina Simone"],
];

// Commandes que la page applique tout de suite à l'écran avant la réponse de Sonos.
export const ACTIONS_IMMEDIATES = new Set(["lecture", "pause", "volumeGroupe", "volumeJoueur", "muetGroupe", "muetJoueur", "toutPause"]);

// Applique une commande à l'état (retourne un nouvel état).
export function appliquerDemo(etat, c) {
  if (c.partout) return etat.groupes.reduce((e, g) => appliquerDemo(e, { ...c, partout: false, groupeId: g.id }), etat);
  const groupes = etat.groupes.map((g) => ({ ...g, joueurs: g.joueurs.map((j) => ({ ...j })) }));
  const groupe = groupes.find((g) => g.id === c.groupeId);
  const piste = (g, delta) => {
    const i = Math.max(0, PISTES.findIndex((p) => p[0] === g.titre));
    const p = PISTES[(i + delta + PISTES.length) % PISTES.length];
    g.titre = p[0];
    g.artiste = p[1];
  };
  const trouverJoueur = (id) => {
    for (const g of groupes) {
      const j = g.joueurs.find((x) => x.id === id);
      if (j) return { g, j };
    }
    return null;
  };
  const moyenne = (g) => (g.joueurs.length ? Math.round(g.joueurs.reduce((a, j) => a + (j.volume || 0), 0) / g.joueurs.length) : g.volume);
  const isoler = (id, avecGroupeId) => {
    const { g, j } = trouverJoueur(id);
    g.joueurs = g.joueurs.filter((x) => x.id !== id);
    groupes.push({ id: avecGroupeId || "n" + id, nom: j.nom, etat: "IDLE", volume: j.volume, muet: j.muet, titre: null, artiste: null, image: null, joueurs: [j] });
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
    case "volumeJoueur": {
      const r = trouverJoueur(c.joueurId);
      if (r) {
        r.j.volume = c.volume;
        r.g.volume = moyenne(r.g);
      }
      break;
    }
    case "muetGroupe":
      groupe.muet = !!c.muet;
      groupe.joueurs.forEach((j) => (j.muet = !!c.muet));
      break;
    case "muetJoueur": {
      const r = trouverJoueur(c.joueurId);
      if (r) {
        r.j.muet = !!c.muet;
        r.g.muet = r.g.joueurs.every((j) => j.muet);
      }
      break;
    }
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
    case "separer":
    case "retirerDuGroupe":
      isoler(c.joueurId);
      break;
    case "ajouterAuGroupe": {
      const r = trouverJoueur(c.joueurId);
      if (r && r.g.id !== groupe.id) {
        r.g.joueurs = r.g.joueurs.filter((x) => x.id !== c.joueurId);
        groupe.joueurs.push(r.j);
        groupe.volume = moyenne(groupe);
      }
      break;
    }
    case "creerGroupe": {
      const ids = c.joueurIds || [];
      const membres = ids.map((id) => trouverJoueur(id)?.j).filter(Boolean);
      groupes.forEach((g) => (g.joueurs = g.joueurs.filter((j) => !ids.includes(j.id))));
      if (membres.length) groupes.push({ id: "gr" + ids.join(""), nom: membres.map((m) => m.nom).slice(0, 2).join(" + "), etat: "IDLE", volume: Math.round(membres.reduce((a, j) => a + j.volume, 0) / membres.length), muet: false, titre: null, artiste: null, image: null, joueurs: membres });
      break;
    }
  }
  return { ...etat, groupes: groupes.filter((g) => g.joueurs.length > 0) };
}
