import { SITE_URL } from "@/lib/seo";

// Plan du site : seulement les pages publiques utiles à Google (jamais les espaces privés).
const PAGES = [
  { chemin: "/", priorite: 1, frequence: "weekly" },
  { chemin: "/scattegories", priorite: 0.8, frequence: "monthly" },
  { chemin: "/contact", priorite: 0.7, frequence: "yearly" },
  { chemin: "/inscription", priorite: 0.7, frequence: "yearly" },
  { chemin: "/telecharger", priorite: 0.6, frequence: "monthly" },
  { chemin: "/aide", priorite: 0.6, frequence: "monthly" },
  { chemin: "/conditions", priorite: 0.3, frequence: "yearly" },
  { chemin: "/confidentialite", priorite: 0.3, frequence: "yearly" },
];

export default function sitemap() {
  const maintenant = new Date();
  return PAGES.map((p) => ({
    url: `${SITE_URL}${p.chemin === "/" ? "" : p.chemin}`,
    lastModified: maintenant,
    changeFrequency: p.frequence,
    priority: p.priorite,
  }));
}
