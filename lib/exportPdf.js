// Export PDF de la feuille de temps (semaine) et des commandes d'une journée.
// Côté navigateur seulement : jsPDF est chargé à la demande (pas dans le bundle de base).

import { TYPES_EQUIPEMENT } from "@/lib/temperature";
import { formatMontant, heureCommande, libelleRamassage, libelleMode, libellePaiement, etatCommande, noteCommande } from "@/lib/commandes";

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
        propre([c.client_nom, c.client_telephone, infos, noteCommande(c) ? `Note: ${noteCommande(c)}` : null].filter(Boolean).join("\n")),
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

// Registre des températures (MAPAQ) : une section par jour, une ligne par équipement avec les relevés AM et PM.
// Les températures non conformes sont en rouge. releves : lignes de releves_temperature.
export async function telechargerPdfTemperatures({ entrepriseNom, succursaleNom, releves, equipements, emplacements = [], nomFichier }) {
  const { doc, autoTable } = await chargerPdf("landscape");
  const eqParId = new Map(equipements.map((e) => [e.id, e]));
  const empParId = new Map(emplacements.map((e) => [e.id, e.nom]));
  const typeLabel = (id) => TYPES_EQUIPEMENT.find((t) => t.id === id)?.label || id;

  const parJour = new Map();
  for (const r of releves) {
    if (!parJour.has(r.date_relevee)) parJour.set(r.date_relevee, new Map());
    const jour = parJour.get(r.date_relevee);
    if (!jour.has(r.equipement_id)) jour.set(r.equipement_id, { am: null, pm: null });
    jour.get(r.equipement_id)[r.periode] = r;
  }
  const dates = [...parJour.keys()].sort().reverse();

  entete(doc, {
    titre: "Registre des temperatures",
    sousTitre: [entrepriseNom, succursaleNom].filter(Boolean).join("  -  "),
    droite: dates.length ? `${dates[dates.length - 1]} au ${dates[0]}` : "",
  });

  const ROUGE = [200, 30, 30];
  const cellule = (r, eq) => {
    if (!r) return { content: "-", styles: { textColor: [150, 150, 150] } };
    const texte = `${String(r.temperature).replace(".", ",")} °${eq?.unite === "F" ? "F" : "C"}${r.conforme ? "" : "  (!)"}`;
    return r.conforme ? texte : { content: texte, styles: { textColor: ROUGE, fontStyle: "bold" } };
  };

  const corps = [];
  for (const date of dates) {
    const libelle = new Date(`${date}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const nonConformes = [...parJour.get(date).values()].reduce((n, l) => n + (l.am && !l.am.conforme ? 1 : 0) + (l.pm && !l.pm.conforme ? 1 : 0), 0);
    corps.push([
      {
        content: propre(`${libelle.charAt(0).toUpperCase()}${libelle.slice(1)}  -  ${nonConformes > 0 ? `${nonConformes} non conforme${nonConformes > 1 ? "s" : ""}` : "conforme"}`),
        colSpan: 6,
        styles: { fillColor: [232, 233, 244], fontStyle: "bold", halign: "left", textColor: nonConformes > 0 ? ROUGE : [20, 20, 40] },
      },
    ]);
    for (const [equipementId, l] of parJour.get(date)) {
      const eq = eqParId.get(equipementId);
      const lieu = eq?.emplacement_id && emplacements.length > 1 ? empParId.get(eq.emplacement_id) : null;
      corps.push([
        propre([eq?.nom || "?", lieu].filter(Boolean).join(" - ")),
        propre(eq ? typeLabel(eq.type) : ""),
        cellule(l.am, eq),
        propre(l.am?.releve_par || ""),
        cellule(l.pm, eq),
        propre(l.pm?.releve_par || ""),
      ]);
    }
  }

  autoTable(doc, {
    startY: 80,
    head: [["Equipement", "Type", "AM", "Releve par", "PM", "Releve par"]],
    body: corps,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 4, valign: "middle", lineColor: [210, 210, 220], lineWidth: 0.4 },
    headStyles: { fillColor: [34, 31, 138], textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 190 }, 2: { halign: "center", cellWidth: 90 }, 4: { halign: "center", cellWidth: 90 } },
    margin: { left: 40, right: 40, bottom: 40 },
  });

  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text("En rouge, (!) : temperature non conforme.", 40, doc.lastAutoTable.finalY + 14);
  doc.setTextColor(0);

  piedDePage(doc);
  doc.save(nomFichier || "registre-temperatures.pdf");
}
