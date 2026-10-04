// Export PDF de la feuille de temps (semaine) et des commandes d'une journée.
// Côté navigateur seulement : jsPDF est chargé à la demande (pas dans le bundle de base).

import { formatMontant, heureCommande, libelleRamassage, libelleMode, libellePaiement, etatCommande } from "@/lib/commandes";

// jsPDF (police Helvetica) ne sait pas afficher les espaces insécables fines des montants
// formatés (U+202F) ni quelques caractères typographiques : on les ramène à du simple.
function propre(texte) {
  return String(texte ?? "")
    .replace(/[   ]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/→/g, "->")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

async function chargerPdf(orientation) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default || autoTableModule.autoTable;
  const doc = new jsPDF({ orientation, unit: "pt", format: "letter" });
  return { doc, autoTable };
}

function entete(doc, { titre, sousTitre, droite }) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(propre(titre), 40, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  if (sousTitre) doc.text(propre(sousTitre), 40, 64);
  if (droite) doc.text(propre(droite), doc.internal.pageSize.getWidth() - 40, 46, { align: "right" });
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

function nomFichierSur(texte) {
  return propre(texte)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

// Feuille de temps d'une semaine.
// jours : ["Lundi 28", ...] ; lignes : [{ nom, parJour: [[ "08:45 - 16:00", ... ] par jour], total: "7.25 h" }]
export async function telechargerPdfFeuilleTemps({ entrepriseNom, succursaleNom, semaineLabel, jours, lignes, totalGeneral, approuvee, aOublis }) {
  const { doc, autoTable } = await chargerPdf("landscape");
  entete(doc, {
    titre: "Feuille de temps",
    sousTitre: [entrepriseNom, succursaleNom, semaineLabel].filter(Boolean).join("  -  "),
    droite: approuvee ? "Semaine approuvee" : "Semaine non approuvee",
  });

  autoTable(doc, {
    startY: 80,
    head: [["Employe", ...jours, "Total"].map(propre)],
    body: lignes.map((l) => [propre(l.nom), ...l.parJour.map((s) => (s.length ? s.map(propre).join("\n") : "-")), propre(l.total)]),
    foot: [["Total de la semaine", ...jours.map(() => ""), propre(totalGeneral)]],
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, valign: "middle", halign: "center", lineColor: [210, 210, 220], lineWidth: 0.4 },
    headStyles: { fillColor: [34, 31, 138], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [240, 240, 246], textColor: 20, fontStyle: "bold" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 100 }, [jours.length + 1]: { fontStyle: "bold", cellWidth: 56 } },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    margin: { left: 40, right: 40 },
  });

  if (aOublis) {
    const y = doc.lastAutoTable.finalY + 14;
    doc.setFontSize(8.5);
    doc.setTextColor(120);
    doc.text("* Depart pose automatiquement a la fermeture : oubli de pointage possible.", 40, y);
    doc.setTextColor(0);
  }

  piedDePage(doc);
  doc.save(`feuille-de-temps-${nomFichierSur(semaineLabel)}.pdf`);
}

// Commandes d'une journée + total à préparer par produit.
export async function telechargerPdfCommandes({ entrepriseNom, dateLabel, dateIso, commandes, totauxProduits }) {
  const { doc, autoTable } = await chargerPdf("portrait");
  const valides = commandes.filter((c) => c.statut !== "CANCELED");
  const totalJour = valides.reduce((somme, c) => somme + Number(c.total), 0);

  entete(doc, {
    titre: "Commandes du jour",
    sousTitre: [entrepriseNom, dateLabel].filter(Boolean).join("  -  "),
    droite: `${valides.length} commande${valides.length > 1 ? "s" : ""}  -  ${formatMontant(totalJour)}`,
  });

  autoTable(doc, {
    startY: 80,
    head: [["No / heure", "Client", "Articles", "Statut", "Total"]],
    body: valides.map((c) => {
      const heure = libelleRamassage(c) ? `Ramassage ${libelleRamassage(c)}` : heureCommande(c.date_commande);
      const infos = [libelleMode(c.mode), c.lieu_nom, libellePaiement(c), c.source === "manuel" ? "Manuelle" : null].filter(Boolean).join(" - ");
      const articles = (c.items || [])
        .map((it) => `${it.quantite} x ${it.nom}${it.options?.length ? ` (${it.options.join(", ")})` : ""}`)
        .join("\n");
      return [
        propre(`#${c.numero || "-"}\n${heure}`),
        propre([c.client_nom, c.client_telephone, infos].filter(Boolean).join("\n")),
        propre(articles),
        propre(etatCommande(c).texte),
        propre(formatMontant(c.total)),
      ];
    }),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, valign: "top", lineColor: [210, 210, 220], lineWidth: 0.4 },
    headStyles: { fillColor: [34, 31, 138], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 82 }, 1: { cellWidth: 130 }, 3: { cellWidth: 62 }, 4: { halign: "right", cellWidth: 58, fontStyle: "bold" } },
    alternateRowStyles: { fillColor: [248, 248, 252] },
    margin: { left: 40, right: 40 },
  });

  if (totauxProduits?.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 22,
      head: [["A preparer (total par produit)", "Quantite"]],
      body: totauxProduits.map((p) => [propre(p.nom), String(p.quantite)]),
      styles: { font: "helvetica", fontSize: 9.5, cellPadding: 4, lineColor: [210, 210, 220], lineWidth: 0.4 },
      headStyles: { fillColor: [34, 31, 138], textColor: 255, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right", cellWidth: 70, fontStyle: "bold" } },
      margin: { left: 40, right: 40 },
    });
  }

  piedDePage(doc);
  doc.save(`commandes-${nomFichierSur(dateIso || dateLabel)}.pdf`);
}
