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

export const PERIODES = [
  { id: "am", label: "Matin (AM)" },
  { id: "pm", label: "Soir (PM)" },
];

// Le créneau se calcule TOUJOURS à l'heure du Québec, peu importe où le code
// roule : le serveur Vercel est en UTC (il passe au "lendemain matin" dès 20 h
// chez nous) et le navigateur peut avoir un autre fuseau. Sans ça, le
// téléphone (via le serveur) et le dashboard ne s'entendaient pas sur la date
// ni sur AM/PM.
const FUSEAU = "America/Toronto";

function partiesQuebec(d) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { annee: get("year"), mois: get("month"), jour: get("day"), heure: Number(get("hour")) };
}

export function dateStr(d = new Date()) {
  const { annee, mois, jour } = partiesQuebec(d);
  return `${annee}-${mois}-${jour}`;
}

// Le créneau "vivant" en ce moment : AM avant midi, PM de midi à minuit.
// Une fois la fenêtre passée sans relevé, elle ne revient jamais - on
// passe au prochain créneau (voir lib/temperature.js côté doc du module).
export function creneauActuel(d = new Date()) {
  return { date: dateStr(d), periode: partiesQuebec(d).heure < 12 ? "am" : "pm" };
}

// Regroupe des relevés en "fiches journalières" : une fiche par date, avec
// pour chaque relevé sa case (équipement + AM/PM). Triées de la plus récente
// à la plus ancienne. Une fiche n'est pas stockée : elle est reconstituée
// à partir des relevés, donc elle se "compile" toute seule à la fin de la journée.
export function grouperParJour(releves) {
  const parDate = new Map();
  for (const r of releves) {
    if (!parDate.has(r.date_relevee)) parDate.set(r.date_relevee, []);
    parDate.get(r.date_relevee).push(r);
  }
  return [...parDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, relevesDuJour]) => ({
      date,
      releves: relevesDuJour,
      nonConformes: relevesDuJour.filter((r) => !r.conforme).length,
    }));
}

function celluleCsv(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV que Excel ouvre directement en français (séparateur ";", virgule
// décimale, BOM UTF-8 pour les accents). Une ligne par équipement et par jour,
// avec les colonnes AM et PM côte à côte.
export function relevesEnCsv(releves, equipements, emplacements = []) {
  const eqParId = new Map(equipements.map((e) => [e.id, e]));
  const empParId = new Map(emplacements.map((e) => [e.id, e.nom]));
  const typeLabel = (id) => TYPES_EQUIPEMENT.find((t) => t.id === id)?.label || id;
  const fmt = (t) => (t === null || t === undefined ? "" : String(t).replace(".", ","));

  const lignes = new Map();
  for (const r of releves) {
    const cle = `${r.date_relevee}|${r.equipement_id}`;
    if (!lignes.has(cle)) lignes.set(cle, { date: r.date_relevee, equipementId: r.equipement_id, am: null, pm: null });
    lignes.get(cle)[r.periode] = r;
  }

  const entete = [
    "Date", "Succursale", "Équipement", "Type",
    "Temp. AM (°C)", "AM conforme", "AM relevé par",
    "Temp. PM (°C)", "PM conforme", "PM relevé par",
  ];

  const corps = [...lignes.values()]
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
    .map((l) => {
      const eq = eqParId.get(l.equipementId);
      const cellules = (r) => [r ? fmt(r.temperature) : "", r ? (r.conforme ? "Oui" : "Non") : "", r ? r.releve_par : ""];
      return [
        l.date,
        (eq?.emplacement_id && empParId.get(eq.emplacement_id)) || "",
        eq?.nom || "?",
        eq ? typeLabel(eq.type) : "",
        ...cellules(l.am),
        ...cellules(l.pm),
      ];
    });

  return "﻿" + [entete, ...corps].map((ligne) => ligne.map(celluleCsv).join(";")).join("\r\n");
}

export function telechargerFichier(nom, contenu, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}
