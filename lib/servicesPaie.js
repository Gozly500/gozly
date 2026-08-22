// Services de paie proposés dans le menu d'export (Feuille de temps) et
// dans l'onglet Intégrations des paramètres. Seul Nethris est branché pour
// l'instant ; les autres sont affichés pour montrer ce qui s'en vient.
export const SERVICES_PAIE = [
  { id: "nethris", label: "Nethris", disponible: true },
  { id: "dayforce", label: "Dayforce", disponible: false },
  { id: "quickbooks", label: "QuickBooks", disponible: false },
];
