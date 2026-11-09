// Modules auxquels un assistant IA peut avoir accès, et ce qu'il peut y faire. Partagé entre le serveur (lib/iaServer.js)
// et les pages (réglages) : aucun import de Node ici.
//
// Les permissions sont celles de l'ENTREPRISE (table ia_reglages), pas d'une connexion : elles s'appliquent à tous les
// assistants branchés, en direct. Forme : { horaire: { actif: true, lire: true, brouillons: true, publier: false }, ... }
// Règle de fond : « publier » (qui notifie les employés) est désactivé par défaut et ne s'active que dans les réglages.

export const MODULES_IA = [
  {
    id: "horaire",
    label: "Horaire & pointage",
    resume: "Quarts de travail, employés (noms seulement), succursales et heures pointées.",
    actions: [
      { id: "lire", label: "Consulter l'horaire et les heures pointées", defaut: true },
      { id: "brouillons", label: "Préparer des quarts en brouillon", detail: "Invisibles des employés tant que l'horaire n'est pas publié.", defaut: true },
      {
        id: "publier",
        label: "Publier l'horaire",
        detail: "Les quarts deviennent visibles et les employés reçoivent une notification. Désactivé par défaut.",
        defaut: false,
        sensible: true,
      },
    ],
  },
  {
    id: "planning",
    label: "Planning (tâches)",
    resume: "Les tâches de chaque journée, par catégorie.",
    actions: [
      { id: "lire", label: "Consulter les tâches et les catégories", defaut: true },
      { id: "creer", label: "Ajouter des tâches aux journées", detail: "Visibles des employés tout de suite (Planning n'a pas de brouillon), sans notification.", defaut: true },
      { id: "supprimer", label: "Supprimer les tâches qu'elle a elle-même ajoutées", detail: "Jamais celles ajoutées par une personne.", defaut: true },
    ],
  },
  {
    id: "inventaire",
    label: "Inventaire",
    resume: "Produits, quantités en stock et seuils d'alerte.",
    actions: [{ id: "lire", label: "Consulter les produits et le stock", defaut: true }],
  },
  {
    id: "ventes",
    label: "Suivi des ventes",
    resume: "Le journal des ventes, avec les totaux par source.",
    actions: [{ id: "lire", label: "Consulter les ventes", defaut: true }],
  },
];

export function permissionsParDefaut() {
  const sortie = {};
  for (const m of MODULES_IA) {
    sortie[m.id] = { actif: true };
    for (const a of m.actions) sortie[m.id][a.id] = a.defaut;
  }
  return sortie;
}

// Nettoie des permissions venues du réseau ou de la base : ne garde que des booléens connus, le reste prend la valeur par défaut.
export function normaliserPermissions(p) {
  const sortie = {};
  for (const m of MODULES_IA) {
    const brut = p && typeof p === "object" && p[m.id] && typeof p[m.id] === "object" ? p[m.id] : {};
    sortie[m.id] = { actif: typeof brut.actif === "boolean" ? brut.actif : true };
    for (const a of m.actions) sortie[m.id][a.id] = typeof brut[a.id] === "boolean" ? brut[a.id] : a.defaut;
  }
  return sortie;
}

// Le module est-il ouvert, et l'action permise ?
export function peut(permissions, module, action) {
  const p = permissions?.[module];
  return !!p && p.actif === true && p[action] === true;
}

export function aUnModuleActif(permissions) {
  return MODULES_IA.some((m) => permissions?.[m.id]?.actif === true);
}
