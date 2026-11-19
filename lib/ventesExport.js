// Exports du Suivi des ventes (Excel = CSV, et PDF) : un rapport de PLUSIEURS journées (résumés) et le détail d'UNE journée
// (transactions lues chez Wix). Sert au navigateur (boutons Exporter) ET au serveur (export automatique vers le nuage) :
// aucun accès au navigateur ici, et les nombres sont mis en forme à la main (pas de locale du navigateur).

const fr = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(".", ",");

function celluleCsv(v) {
  const s = String(v ?? "");
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function versCsv(lignes) {
  return "\uFEFF" + lignes.map((l) => l.map(celluleCsv).join(";")).join("\r\n");
}

// Modes de paiement présents dans les journées, du plus gros au plus petit total.
export function modesDePaiement(jours) {
  const totaux = {};
  for (const j of jours) for (const [mode, montant] of Object.entries(j.par_paiement || {})) totaux[mode] = (totaux[mode] || 0) + Number(montant);
  return Object.keys(totaux).sort((a, b) => totaux[b] - totaux[a]);
}

export function totalJour(j) {
  return Number(j.total_en_ligne || 0) + Number(j.total_comptoir || 0);
}

// Écart entre le total Moneris saisi et le total « carte » de Wix (null tant que le total Moneris n'est pas saisi).
export function totalCarte(j) {
  return Object.entries(j.par_paiement || {})
    .filter(([mode]) => /carte|card|debit|credit/i.test(mode))
    .reduce((s, [, m]) => s + Number(m), 0);
}

export function ecartMoneris(j) {
  if (j.moneris_total === null || j.moneris_total === undefined || j.moneris_total === "") return null;
  return Math.round((Number(j.moneris_total) - totalCarte(j)) * 100) / 100;
}

// ----- CSV (Excel) -----

export function journeesEnCsv(jours) {
  const modes = modesDePaiement(jours);
  const entete = ["Date", "Ventes en ligne", "Ventes au comptoir", "Total en ligne", "Total comptoir", "Total", "Taxes", "Pourboires", "Remboursements", ...modes, "Total Moneris", "Écart Moneris", "Conciliée"];
  const corps = [...jours]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((j) => {
      const ecart = ecartMoneris(j);
      return [
        j.date,
        j.nb_en_ligne,
        j.nb_comptoir,
        fr(j.total_en_ligne),
        fr(j.total_comptoir),
        fr(totalJour(j)),
        fr(j.taxes),
        fr(j.pourboires),
        fr(j.remboursements),
        ...modes.map((m) => fr((j.par_paiement || {})[m] || 0)),
        j.moneris_total === null || j.moneris_total === undefined ? "" : fr(j.moneris_total),
        ecart === null ? "" : fr(ecart),
        j.conciliee ? "Oui" : "Non",
      ];
    });
  const somme = (cle) => jours.reduce((s, j) => s + Number(j[cle] || 0), 0);
  const total = [
    "Total",
    somme("nb_en_ligne"),
    somme("nb_comptoir"),
    fr(somme("total_en_ligne")),
    fr(somme("total_comptoir")),
    fr(jours.reduce((s, j) => s + totalJour(j), 0)),
    fr(somme("taxes")),
    fr(somme("pourboires")),
    fr(somme("remboursements")),
    ...modes.map((m) => fr(jours.reduce((s, j) => s + Number((j.par_paiement || {})[m] || 0), 0))),
    "",
    "",
    "",
  ];
  return versCsv([entete, ...corps, total]);
}

export function transactionsEnCsv(date, transactions) {
  const entete = ["Date", "Heure", "Canal", "Numéro", "Mode de paiement", "Statut", "Total", "Taxes", "Pourboire", "Remboursé", "Net", "Comptée"];
  const heure = (iso) =>
    new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  const corps = [...transactions]
    .sort((a, b) => String(a.heure).localeCompare(String(b.heure)))
    .map((t) => [date, heure(t.heure), t.canal === "comptoir" ? "Comptoir" : "En ligne", t.numero, t.methode, t.statut, fr(t.brut), fr(t.taxes), fr(t.pourboire), fr(t.rembourse), fr(t.total), t.comptee ? "Oui" : "Non"]);
  return versCsv([entete, ...corps]);
}

// ----- PDF -----

// jsPDF (police Helvetica) ne sait pas afficher quelques caractères typographiques.
function propre(texte) {
  return String(texte ?? "")
    .replace(/[\u00a0\u202f\u2009]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

const montant = (n) => `${fr(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} $`;

async function nouveauPdf(orientation) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default || autoTableModule.autoTable;
  return { doc: new jsPDF({ orientation, unit: "pt", format: "letter" }), autoTable };
}

function enteteEtPied(doc, titre, sousTitre) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(propre(titre), 40, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  if (sousTitre) doc.text(propre(sousTitre), 40, 64);
  doc.setTextColor(0);
}

function piedDePage(doc) {
  const pages = doc.getNumberOfPages();
  const largeur = doc.internal.pageSize.getWidth();
  const hauteur = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(130);
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.text(`Gozly - page ${i}/${pages}`, largeur - 40, hauteur - 24, { align: "right" });
  }
  doc.setTextColor(0);
}

const STYLES = { font: "helvetica", fontSize: 8.5, cellPadding: 4, valign: "middle", halign: "right", lineColor: [210, 210, 220], lineWidth: 0.4 };
const ENTETE = { fillColor: [34, 31, 138], textColor: 255, fontStyle: "bold" };
const PIED = { fillColor: [240, 240, 246], textColor: 20, fontStyle: "bold" };

// Rapport de plusieurs journées (résumés).
export async function pdfJournees({ entrepriseNom, periodeLabel, jours }) {
  const { doc, autoTable } = await nouveauPdf("landscape");
  enteteEtPied(doc, "Rapport des ventes", [entrepriseNom, periodeLabel].filter(Boolean).join("  -  "));
  const modes = modesDePaiement(jours);
  const triees = [...jours].sort((a, b) => (a.date < b.date ? -1 : 1));
  const somme = (cle) => jours.reduce((s, j) => s + Number(j[cle] || 0), 0);

  autoTable(doc, {
    startY: 80,
    head: [["Date", "Nb", "Total", "Taxes", "Rembours.", ...modes, "Moneris", "Ecart", "Conciliee"].map(propre)],
    body: triees.map((j) => {
      const ecart = ecartMoneris(j);
      return [
        j.date,
        String(Number(j.nb_en_ligne || 0) + Number(j.nb_comptoir || 0)),
        montant(totalJour(j)),
        montant(j.taxes),
        montant(j.remboursements),
        ...modes.map((m) => montant((j.par_paiement || {})[m] || 0)),
        j.moneris_total === null || j.moneris_total === undefined ? "-" : montant(j.moneris_total),
        ecart === null ? "-" : montant(ecart),
        j.conciliee ? "Oui" : "Non",
      ].map(propre);
    }),
    foot: [
      [
        "Total",
        String(somme("nb_en_ligne") + somme("nb_comptoir")),
        montant(jours.reduce((s, j) => s + totalJour(j), 0)),
        montant(somme("taxes")),
        montant(somme("remboursements")),
        ...modes.map((m) => montant(jours.reduce((s, j) => s + Number((j.par_paiement || {})[m] || 0), 0))),
        "",
        "",
        "",
      ].map(propre),
    ],
    styles: STYLES,
    headStyles: ENTETE,
    footStyles: PIED,
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    margin: { left: 40, right: 40 },
  });

  piedDePage(doc);
  return doc;
}

// Détail d'une journée : résumé + liste des transactions.
export async function pdfJournee({ entrepriseNom, dateLabel, resume, transactions }) {
  const { doc, autoTable } = await nouveauPdf("portrait");
  enteteEtPied(doc, "Ventes du " + dateLabel, entrepriseNom);

  const modes = Object.entries(resume.par_paiement || {});
  autoTable(doc, {
    startY: 80,
    head: [["Resume de la journee", ""]],
    body: [
      ["Ventes en ligne", `${resume.nb_en_ligne} - ${montant(resume.total_en_ligne)}`],
      ["Ventes au comptoir", `${resume.nb_comptoir} - ${montant(resume.total_comptoir)}`],
      ["Total", montant(totalJour(resume))],
      ["Taxes", montant(resume.taxes)],
      ["Pourboires", montant(resume.pourboires)],
      ["Remboursements", montant(resume.remboursements)],
      ...modes.map(([m, v]) => [propre(m), montant(v)]),
    ],
    styles: { ...STYLES, halign: "left" },
    headStyles: ENTETE,
    columnStyles: { 1: { halign: "right" } },
    tableWidth: 300,
    margin: { left: 40, right: 40 },
  });

  const heure = (iso) => new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 18,
    head: [["Heure", "Canal", "No", "Paiement", "Statut", "Net"].map(propre)],
    body: [...transactions]
      .sort((a, b) => String(a.heure).localeCompare(String(b.heure)))
      .map((t) => [heure(t.heure), t.canal === "comptoir" ? "Comptoir" : "En ligne", t.numero, t.methode, t.statut, montant(t.total)].map(propre)),
    styles: { ...STYLES, halign: "left" },
    headStyles: ENTETE,
    columnStyles: { 5: { halign: "right" } },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    margin: { left: 40, right: 40 },
  });

  piedDePage(doc);
  return doc;
}

export const octetsPdf = (doc) => Buffer.from(doc.output("arraybuffer"));
