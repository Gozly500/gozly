// Registre central des modules disponibles. Pour ajouter un module plus
// tard : une seule entrée ici, tout le reste (sidebar, tableau de bord,
// popup d'activation) s'ajuste automatiquement.
export const MODULES = [
  {
    id: "planning",
    nom: "Planning",
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
};

export const LABELS_FORFAIT = {
  opale: "Opale",
  onyx: "Onyx",
  crystal: "Crystal",
};

export function limiteModules(forfait) {
  return LIMITES_FORFAIT[forfait] ?? 0;
}
