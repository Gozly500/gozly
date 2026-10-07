import { IconPlanning, IconHoraire, IconInventaire, IconVentes, IconTemperature, IconCommandes } from "@/components/icons/GozlyIcons";

// Icône « maison » de chaque module (par id), pour les listes de modules : remplace les anciens émojis.
export const ICONES_MODULES = {
  planning: IconPlanning,
  horaire: IconHoraire,
  inventaire: IconInventaire,
  ventes: IconVentes,
  temperature: IconTemperature,
  commandes: IconCommandes,
};

export function IconeModule({ id, ...props }) {
  const Icone = ICONES_MODULES[id];
  return Icone ? <Icone {...props} /> : null;
}
