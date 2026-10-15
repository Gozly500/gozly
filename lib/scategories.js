// Données du jeu Scategories : préréglages de catégories (FR/EN) et lettres.
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const LETTRES_DIFFICILES = ["Q", "W", "X", "Y", "Z"];
export const DUREES = [60, 120, 180, 300];
export const CLE_STOCKAGE = "gozly-scategories";

export const PRESETS = [
  {
    id: "classique",
    fr: ["Animal", "Pays", "Prénom", "Objet", "Ville", "Nourriture", "Marque", "Film", "Sport", "Couleur"],
    en: ["Animal", "Country", "First name", "Object", "City", "Food", "Brand", "Movie", "Sport", "Color"],
  },
  {
    id: "difficile",
    fr: ["Expression", "Invention", "Personnage historique", "Livre", "Sport", "Plante", "Outil", "Nourriture", "Accessoire", "Transport"],
    en: ["Expression", "Invention", "Historical figure", "Book", "Sport", "Plant", "Tool", "Food", "Accessory", "Transportation"],
  },
  {
    id: "drole",
    fr: ["Chose dégoûtante", "Excuse bidon", "Objet inutile", "Insulte gentille", "Super-pouvoir", "Animal bizarre", "Mauvaise habitude", "Objet de cuisine", "Chose qui pue", "Activité dangereuse"],
    en: ["Disgusting thing", "Lame excuse", "Useless object", "Gentle insult", "Superpower", "Weird animal", "Bad habit", "Kitchen item", "Smelly thing", "Dangerous activity"],
  },
  {
    id: "ecole",
    fr: ["Pays", "Ville", "Célébrité", "Livre", "Science", "Matière scolaire", "Événement historique", "Artiste", "Instrument", "Sport"],
    en: ["Country", "City", "Celebrity", "Book", "Science", "School subject", "Historical event", "Artist", "Instrument", "Sport"],
  },
  {
    id: "rapide",
    fr: ["Animal", "Objet", "Nourriture", "Couleur", "Prénom", "Ville", "Marque", "Fruit", "Accessoire", "Boisson"],
    en: ["Animal", "Object", "Food", "Color", "First name", "City", "Brand", "Fruit", "Accessory", "Drink"],
  },
  {
    id: "jeuxvideo",
    fr: ["Personnage de jeu", "Arme", "Monstre", "Lieu", "Objet rare", "Boss", "Studio", "Console", "Pouvoir", "Jeu rétro"],
    en: ["Game character", "Weapon", "Monster", "Place", "Rare item", "Boss", "Studio", "Console", "Power", "Retro game"],
  },
  {
    id: "horreur",
    fr: ["Créature", "Lieu effrayant", "Objet maudit", "Personne disparue", "Surnom creepy", "Phobie", "Légende urbaine", "Bruitage", "Film d'horreur", "Symbole occulte"],
    en: ["Creature", "Scary place", "Cursed object", "Missing person", "Creepy nickname", "Phobia", "Urban legend", "Sound effect", "Horror movie", "Occult symbol"],
  },
  {
    id: "sport",
    fr: ["Sport", "Athlète", "Équipement", "Équipe", "Stade", "Pays sportif", "Record", "Entraîneur", "Compétition", "Mouvement"],
    en: ["Sport", "Athlete", "Equipment", "Team", "Stadium", "Sporting nation", "Record", "Coach", "Competition", "Move"],
  },
  {
    id: "cuisine",
    fr: ["Plat", "Ustensile", "Ingrédient", "Chef célèbre", "Boisson", "Fruit", "Légume", "Recette", "Odeur", "Restaurant"],
    en: ["Dish", "Utensil", "Ingredient", "Famous chef", "Drink", "Fruit", "Vegetable", "Recipe", "Smell", "Restaurant"],
  },
  {
    id: "soiree",
    fr: ["Cocktail", "Musique", "Danse", "Accessoire", "Décoration", "Jeu", "Collation", "Invité", "Ambiance", "Souvenir"],
    en: ["Cocktail", "Music", "Dance", "Accessory", "Decoration", "Game", "Snack", "Guest", "Vibe", "Souvenir"],
  },
];

export function presetCategories(id, lang) {
  const p = PRESETS.find((x) => x.id === id) || PRESETS[0];
  return [...(lang === "en" ? p.en : p.fr)];
}

export function formatTemps(secondes) {
  const s = Math.max(0, Math.round(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
