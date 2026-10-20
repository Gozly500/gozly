// Lit le dossier Avatard et génère lib/avatarPieces.js (pièces SVG prêtes à empiler).
const fs = require("fs");
const path = require("path");
const SRC = "C:/Users/gulou/OneDrive/Pictures/Gozly/Gozly/Avatard";
const OUT = "C:/Users/gulou/Downloads/gozly-app/gozly-app/lib/avatarPieces.js";

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\.svg$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const label = (f) => { const b = f.replace(/\.svg$/i, ""); return b.charAt(0).toUpperCase() + b.slice(1); };

function lire(fichier) {
  const s = fs.readFileSync(fichier, "utf8");
  const m = s.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/);
  if (!m) throw new Error("SVG illisible : " + fichier);
  const [, viewBox, interieur] = m;
  return { viewBox, contenu: interieur.replace(/<!--[\s\S]*?-->/g, "").replace(/\n\s*/g, "").trim() };
}

function liste(dossier, filtre = () => true) {
  return fs.readdirSync(path.join(SRC, dossier)).filter((f) => f.toLowerCase().endsWith(".svg") && filtre(f)).sort((a, b) => a.localeCompare(b, "fr"));
}

const piece = (dossier, f, extra = {}) => {
  const { viewBox, contenu } = lire(path.join(SRC, dossier, f));
  return { id: slug(f), label: label(f), viewBox, contenu, ...extra };
};

// Hauteur du sommet du dessin (sur la toile de 1182 x 1772) pour cadrer l'avatar avec son chapeau.
const HAUT = { bonet: 291, "casquette-a-l-enver": 409, "chapeau-chic": 184, "chapeaux-de-cuisinier": 53, "chapeaux-melon": 342 };
const COULEURS_MODIFIABLES = new Set(["bonet", "casquette-a-l-enver"]);

const corps = [piece("", "Corp Avatard.svg")].map((p) => ({ ...p, id: "corps", label: "Corps" }));
const yeux = liste("Yeux").map((f) => piece("Yeux", f));
const bouche = liste("Bouche").map((f) => piece("Bouche", f));
const chapeaux = liste("accessoir", (f) => !/lunette/i.test(f)).map((f) => {
  const p = piece("accessoir", f);
  if (!(p.id in HAUT)) throw new Error("Hauteur inconnue pour " + p.id);
  return { ...p, haut: HAUT[p.id], couleur: COULEURS_MODIFIABLES.has(p.id) };
});
// « Lunette ronde » est sur une toile plus petite (704 x 293) : on la place au centre des yeux (même échelle).
const lunettes = liste("accessoir", (f) => /lunette/i.test(f)).map((f) => {
  const p = piece("accessoir", f);
  return p.viewBox === "0 0 1182 1772" ? p : { ...p, placement: { x: 236, y: 936 } };
});

const sortie = `// GÉNÉRÉ à partir du dossier Avatard (images SVG de l'utilisateur) : ne pas modifier à la main.
// Toile commune : 1182 x 1772 (100 x 150 mm). La tête (corps, yeux, bouche : 1182 x 1182) est dans le bas, décalée de 590.
export const PIECES = ${JSON.stringify({ corps, yeux, bouche, chapeaux, lunettes }, null, 1)};
`;
fs.writeFileSync(OUT, sortie);
console.log("ok", { yeux: yeux.length, bouche: bouche.length, chapeaux: chapeaux.map((c) => c.id + (c.couleur ? "*" : "")), lunettes: lunettes.map((l) => l.id + (l.placement ? "(placée)" : "")), taille: Math.round(sortie.length / 1024) + " Ko" });
