// Registre des permissions accordables à un membre non-propriétaire, groupé
// par module - un propriétaire a toujours accès complet sans passer par ici
// (voir a_permission() côté Supabase). Pour ajouter une permission à un futur
// module : ajouter une entrée ici (aucune migration SQL requise, la colonne
// membre_permissions.permission est un texte libre) + une policy RLS qui
// appelle a_permission(entreprise_id, 'ton_id', emplacement_id).
export const PERMISSIONS = [
  {
    id: "voir_feuille_temps",
    module: "horaire",
    label: "Voir la feuille de temps",
    description: "Lecture des semaines approuvées seulement.",
  },
  {
    id: "gerer_feuille_temps",
    module: "horaire",
    label: "Gérer la feuille de temps",
    description: "Corriger les pointages. Voit aussi les semaines pas encore approuvées.",
  },
  {
    id: "approuver_feuille_temps",
    module: "horaire",
    label: "Approuver les feuilles de temps",
    description: "Peut approuver une semaine. Voit aussi les semaines pas encore approuvées.",
  },
  {
    id: "gerer_horaire",
    module: "horaire",
    label: "Gérer l'horaire",
    description: "Créer et modifier les quarts du Planning.",
  },
];

export const MODULES_PERMISSIONS = {
  horaire: "Horaire & Pointage",
};

export function permissionsParModule() {
  return PERMISSIONS.reduce((acc, p) => {
    (acc[p.module] ||= []).push(p);
    return acc;
  }, {});
}
