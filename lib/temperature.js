// Seuils de conformité MAPAQ (réfrigération 0-4°C, congélation -18°C ou
// moins, maintien au chaud 60°C ou plus). "autre" n'a pas de seuil - un
// relevé "autre" est toujours considéré conforme (juste un suivi manuel).
export const TYPES_EQUIPEMENT = [
  { id: "refrigerateur", label: "Réfrigérateur", min: 0, max: 4 },
  { id: "congelateur", label: "Congélateur", min: null, max: -18 },
  { id: "chaud", label: "Maintien au chaud", min: 60, max: null },
  { id: "autre", label: "Autre", min: null, max: null },
];

export function estConforme(typeId, temperature) {
  const type = TYPES_EQUIPEMENT.find((t) => t.id === typeId);
  if (!type) return true;
  if (type.min !== null && temperature < type.min) return false;
  if (type.max !== null && temperature > type.max) return false;
  return true;
}
