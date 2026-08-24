// Registre des widgets du tableau de bord. Pour ajouter un widget pour un
// futur module : une entrée ici (avec moduleId pointant vers lib/modules.js)
// + un composant dans components/dashboard/. Le mécanisme d'édition/
// réordonnancement (DashboardContent.jsx) n'a rien à savoir de plus.
//
// moduleId: null = toujours éligible (ex: les raccourcis de modules).
// moduleId: "xxx" = éligible seulement si ce module est actif pour l'entreprise.
// taille: "horizontal" (pleine largeur) ou "vertical" (une colonne, se place
// à côté d'un autre widget vertical).
export const WIDGETS = [
  { id: "raccourcis", nom: "Raccourcis des modules", moduleId: null, taille: "horizontal" },
  { id: "planning-jour", nom: "Planning du jour", moduleId: "planning", taille: "vertical" },
  { id: "horaire-jour", nom: "Équipe d'aujourd'hui", moduleId: "horaire", taille: "vertical" },
  { id: "inventaire-alertes", nom: "Produits en alerte de stock", moduleId: "inventaire", taille: "vertical" },
  { id: "ventes-jour", nom: "Ventes du jour", moduleId: "ventes", taille: "vertical" },
];

// Fusionne la config sauvegardée (ordre + visibilité) avec le registre :
// garde l'ordre stocké, ajoute à la fin tout widget du registre absent de
// la config (nouveaux widgets ajoutés depuis la dernière sauvegarde).
export function fusionnerConfigWidgets(configSauvegardee) {
  const config = Array.isArray(configSauvegardee) ? configSauvegardee : [];
  const idsConnus = new Set(WIDGETS.map((w) => w.id));
  const idsDejaDansConfig = new Set(config.map((c) => c.id));

  const ordonnes = config
    .filter((c) => idsConnus.has(c.id))
    .map((c) => ({ id: c.id, visible: c.visible !== false }));

  const nouveaux = WIDGETS.filter((w) => !idsDejaDansConfig.has(w.id)).map((w) => ({ id: w.id, visible: true }));

  return [...ordonnes, ...nouveaux];
}
