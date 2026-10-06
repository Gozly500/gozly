// Registre des écrans « kiosque » (tablette ou écran fixe dans le commerce). La page
// /dashboard/kiosques les liste tous au même endroit, pour les modules actifs de l'entreprise.
// Pour en ajouter un : une entrée ici (module = id du module dans lib/modules.js).
export const KIOSQUES = [
  {
    id: "pointage",
    module: "horaire",
    nom: "Pointage",
    description: "L'écran où les employés pointent leur arrivée et leur départ.",
    href: "/dashboard/pointage",
  },
  {
    id: "taches",
    module: "planning",
    nom: "Tâches du jour",
    description: "La liste des tâches du jour à cocher, par catégorie.",
    href: "/dashboard/planning-kiosk",
  },
  {
    id: "inventaire",
    module: "inventaire",
    nom: "Inventaire",
    description: "La liste de ce qu'il faut aller chercher ou réapprovisionner.",
    href: "/dashboard/inventaire-kiosk",
  },
  {
    id: "commandes",
    module: "commandes",
    nom: "Commandes",
    description: "Les commandes du jour, à venir, avec le son d'alerte et l'impression des bons.",
    href: "/dashboard/commandes-kiosk",
  },
];
