// Registre central des modules disponibles. Pour ajouter un module plus
// tard : une seule entrée ici, tout le reste (sidebar, tableau de bord,
// popup d'activation) s'ajuste automatiquement.
export const MODULES = [
  {
    id: "planning",
    nom: "Tâches",
    image: "/icone-planning.svg",
    icon: "📅",
    href: "/dashboard/planning",
  },
  {
    id: "horaire",
    nom: "Horaire & Pointage",
    image: "/icone-horaire.svg",
    icon: "🕒",
    href: "/dashboard/horaire",
  },
  {
    id: "inventaire",
    nom: "Inventaire",
    image: "/icone-inventaire.svg",
    icon: "📦",
    href: "/dashboard/inventaire",
  },
  {
    id: "ventes",
    nom: "Suivi des ventes",
    image: "/icone-ventes.svg",
    icon: "💰",
    href: "/dashboard/ventes",
  },
  {
    id: "temperature",
    nom: "Températures",
    image: "/icone-temperature.svg",
    icon: "🌡️",
    href: "/dashboard/temperature",
  },
  {
    id: "commandes",
    nom: "Commandes en ligne",
    image: "/icone-commandes.svg",
    icon: "🛍️",
    href: "/dashboard/commandes",
  },
];

// Sources de vente supportées - "wix" est un hook pour la future
// synchronisation automatique (voir ventes.sql) ; les autres s'entrent à
// la main pour l'instant.
export const SOURCES_VENTE = [
  { id: "wix", label: "Wix" },
  { id: "moneris", label: "Moneris" },
  { id: "comptant", label: "Comptant" },
  { id: "autre", label: "Autre" },
];

// Nombre de modules activables selon le forfait (voir /s-abonner).
export const LIMITES_FORFAIT = {
  opale: 3,
  onyx: 5,
  crystal: Infinity,
  // Forfait interne : jamais affiché publiquement, pas dans Stripe. Assigné à
  // la main dans le panneau admin (Pasta, comptes de test). Mêmes droits que Crystal.
  pilote: Infinity,
};

export const LABELS_FORFAIT = {
  opale: "Opale",
  onyx: "Onyx",
  crystal: "Crystal",
  pilote: "Pilote",
};

export function limiteModules(forfait) {
  return LIMITES_FORFAIT[forfait] ?? 0;
}

// Nombre d'entreprises (dashboards séparés) qu'un même COMPTE peut posséder
// - distinct de LIMITES_FORFAIT (modules actifs DANS une entreprise). Sans
// forfait (compte tout neuf, rien payé) : 1 - la toute première entreprise
// créée à l'inscription reste gratuite.
export const LIMITES_ENTREPRISES = {
  opale: 1,
  onyx: 3,
  crystal: 5,
  pilote: Infinity,
};

export function limiteEntreprises(forfait) {
  return LIMITES_ENTREPRISES[forfait] ?? 1;
}
