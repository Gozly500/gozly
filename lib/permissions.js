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
    id: "corriger_feuille_temps",
    module: "horaire",
    label: "Corriger la feuille de temps",
    description: "Modifier l'heure d'arrivée et de départ d'une personne et sauvegarder la correction.",
  },
  {
    id: "approuver_feuille_temps",
    module: "horaire",
    label: "Approuver les feuilles de temps",
    description: "Peut approuver une semaine. Voit aussi les semaines pas encore approuvées.",
  },
  {
    id: "exporter_feuille_temps",
    module: "horaire",
    label: "Exporter les feuilles de temps",
    description: "Exporter la feuille de temps de la semaine actuelle ou d'une semaine passée (seulement les semaines approuvées).",
  },
  {
    id: "gerer_horaire",
    module: "horaire",
    label: "Gérer l'horaire",
    description: "Créer, modifier et publier les quarts du Planning d'une ou plusieurs succursales.",
  },
  {
    id: "approuver_demandes",
    module: "horaire",
    label: "Approuver les demandes",
    description: "Approuver les demandes de congé ou d'échange de quart, si ce module est activé.",
  },
];

export function permissionsParModule() {
  return PERMISSIONS.reduce((acc, p) => {
    (acc[p.module] ||= []).push(p);
    return acc;
  }, {});
}
