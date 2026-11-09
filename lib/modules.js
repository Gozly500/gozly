// Registre central des modules disponibles. Pour ajouter un module plus
// tard : une seule entrée ici, tout le reste (sidebar, tableau de bord,
// popup d'activation) s'ajuste automatiquement.
export const MODULES = [
  {
    id: "planning",
    nom: "Tâches",
    image: "/icone-planning.svg",
    href: "/dashboard/planning",
  },
  {
    id: "horaire",
    nom: "Horaire & Pointage",
    image: "/icone-horaire.svg",
    href: "/dashboard/horaire",
  },
  {
    id: "inventaire",
    nom: "Inventaire",
    image: "/icone-inventaire.svg",
    href: "/dashboard/inventaire",
  },
  {
    id: "ventes",
    nom: "Suivi des ventes",
    image: "/icone-ventes.svg",
    href: "/dashboard/ventes",
  },
  {
    id: "temperature",
    nom: "Températures",
    image: "/icone-temperature.svg",
    href: "/dashboard/temperature",
  },
  {
    id: "commandes",
    nom: "Commandes",
    image: "/icone-commandes.svg",
    href: "/dashboard/commandes",
  },
  {
    id: "musique",
    nom: "Musique",
    image: "/icone-musique.svg",
    href: "/dashboard/musique",
  },
];

// Sources de vente supportées - "wix" est un hook pour la future
// synchronisation automatique (voir ventes.sql) ; les autres s'entrent à
// la main pour l'instant.
export const SOURCES_VENTE = [
  { id: "wix", label: "Wix (en ligne)" },
  { id: "wix_pos", label: "Wix (point de vente)" },
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
  // la main dans le panneau admin (clients pilotes, comptes de test). Mêmes droits que Crystal.
  pilote: Infinity,
};

export const LABELS_FORFAIT = {
  opale: "Opale",
  onyx: "Onyx",
  crystal: "Crystal",
  pilote: "Pilote",
};

// Forfaits lus dans la table `forfaits` (voir lib/useForfaits.js et supabase/forfaits_gerables.sql) : { id: { label, limite_modules,
// limite_entreprises } } (null = illimité). Tant qu'ils ne sont pas chargés, les valeurs d'origine ci-dessus servent. Un forfait inconnu
// (ex: personnalisé) n'est PAS bloqué avant le chargement.
let registre = null;

export function definirForfaits(lignes) {
  registre = {};
  for (const l of lignes || []) {
    registre[l.id] = { label: l.label, limite_modules: l.limite_modules, limite_entreprises: l.limite_entreprises };
  }
}

export function labelForfait(forfait) {
  return registre?.[forfait]?.label || LABELS_FORFAIT[forfait] || forfait;
}

export function limiteModules(forfait) {
  if (!forfait) return 0;
  const f = registre?.[forfait];
  if (f) return f.limite_modules ?? Infinity;
  if (LIMITES_FORFAIT[forfait] !== undefined) return LIMITES_FORFAIT[forfait];
  return registre ? 0 : Infinity;
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
  const f = registre?.[forfait];
  if (f) return f.limite_entreprises ?? Infinity;
  if (LIMITES_ENTREPRISES[forfait] !== undefined) return LIMITES_ENTREPRISES[forfait];
  return !forfait || registre ? 1 : Infinity;
}
