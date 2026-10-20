// Logos des plateformes musicales (public/plateformes). Sonos donne le nom du service de chaque favori
// (« Spotify », « Apple Music », « YouTube Music »...) : on le reconnaît par un mot-clé, sans tenir compte des
// accents ni des majuscules. Un service inconnu garde simplement sa première lettre.
//   plein : l'image est déjà une icône d'application (coins arrondis, fond de couleur) -> elle remplit la pastille.
//   zoom  : agrandit les logos qui ont de grandes marges blanches dans leur fichier.
const LOGOS = [
  { mots: ["spotify"], fichier: "spotify.webp" },
  { mots: ["apple"], fichier: "apple-music.webp", plein: true },
  { mots: ["youtube"], fichier: "youtube-music.webp", zoom: 1.65 },
  { mots: ["amazon"], fichier: "amazon-music.webp" },
  { mots: ["deezer"], fichier: "deezer.webp" },
  { mots: ["tunein", "tune in"], fichier: "tunein.webp", plein: true },
  { mots: ["sonos"], fichier: "sonos.webp", plein: true },
  { mots: ["tidal"], fichier: "tidal.svg" },
  { mots: ["qobuz"], fichier: "qobuz.png", zoom: 1.2 },
  { mots: ["soundcloud"], fichier: "soundcloud.png", plein: true },
  { mots: ["iheart"], fichier: "iheartradio.png", zoom: 1.1 },
  { mots: ["pandora"], fichier: "pandora.jpg", zoom: 1.6 },
  { mots: ["stingray", "stingay"], fichier: "stingray.png", plein: true },
];

const normaliser = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function logoPlateforme(nom) {
  const n = normaliser(nom);
  const logo = LOGOS.find((l) => l.mots.some((m) => n.includes(m)));
  return logo ? { src: `/plateformes/${logo.fichier}`, plein: !!logo.plein, zoom: logo.zoom || 1 } : null;
}
