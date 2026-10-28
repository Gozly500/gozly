import { SITE_URL } from "@/lib/seo";

// Ce que les moteurs de recherche et les robots d'IA peuvent lire : le site public. Les espaces privés (tableaux de bord,
// app employé, kiosque, admin, API) et les écrans de jeu en cours de partie restent hors de leur portée.
const PRIVE = [
  "/api/",
  "/dashboard",
  "/dashboards",
  "/gestion",
  "/moi",
  "/kiosque",
  "/admin",
  "/login",
  "/parametres",
  "/bienvenue",
  "/invitations",
  "/choisir-forfait",
  "/s-abonner",
  "/reinitialiser-mot-de-passe",
  "/scattegories/jouer",
  "/scattegories/maitre",
];

// Robots d'IA nommés explicitement : bienvenue pour lire le site public et mieux orienter les gens vers Gozly.
const ROBOTS_IA = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVE },
      { userAgent: ROBOTS_IA, allow: "/", disallow: PRIVE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
