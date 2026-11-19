// Charte graphique de Gozly en PDF, générée dans le navigateur (jsPDF est chargé à la demande). Mêmes données que la page /marque.

import { COULEURS, DEGRADE_SIGNATURE, POLICES, THEMES, rgb } from "@/lib/marque";

const NAVY = rgb("#0d0d3f");
const VIOLET = rgb("#7a3fe0");

// Le SVG du logo est converti en PNG (jsPDF n'insère pas de SVG) : dessiné dans un canvas.
async function logoEnPng() {
  try {
    const texte = await (await fetch("/gozly-logo.svg")).text();
    const svg = texte.replace('width="100%"', 'width="1200"').replace('height="100%"', 'height="1200"');
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    // Le logo occupe le centre d'une grande zone vide : on le dessine en grand, on repère son contour, puis on recadre.
    const brut = document.createElement("canvas");
    brut.width = 1200;
    brut.height = 1200;
    const ctx = brut.getContext("2d");
    ctx.drawImage(img, 0, 0, 1200, 1200);
    const px = ctx.getImageData(0, 0, 1200, 1200).data;
    let x0 = 1200, y0 = 1200, x1 = 0, y1 = 0;
    for (let y = 0; y < 1200; y++) for (let x = 0; x < 1200; x++) if (px[(y * 1200 + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const cote = Math.max(x1 - x0, y1 - y0) + 40;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    canvas.getContext("2d").drawImage(brut, cx - cote / 2, cy - cote / 2, cote, cote, 0, 0, 400, 400);
    URL.revokeObjectURL(url);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function propre(texte) {
  return String(texte ?? "")
    .replace(/[   ]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

export async function telechargerCharteGraphique() {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const L = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const logo = await logoEnPng();

  const titre = (texte, y = 70) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(...NAVY);
    doc.text(propre(texte), 56, y);
    doc.setFillColor(...VIOLET);
    doc.roundedRect(56, y + 10, 46, 4, 2, 2, "F");
    doc.setTextColor(0);
  };
  const paragraphe = (texte, y, taille = 11, couleur = 70) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(taille);
    doc.setTextColor(couleur);
    const lignes = doc.splitTextToSize(propre(texte), L - 112);
    doc.text(lignes, 56, y);
    doc.setTextColor(0);
    return y + lignes.length * (taille + 4);
  };
  const degrade = (x, y, w, h) => {
    const [a, b, c] = DEGRADE_SIGNATURE.map(rgb);
    const n = 60;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const [p, q, f] = t < 0.5 ? [a, b, t * 2] : [b, c, (t - 0.5) * 2];
      doc.setFillColor(...p.map((v, k) => Math.round(v + (q[k] - v) * f)));
      doc.rect(x + (w / n) * i, y, w / n + 0.6, h, "F");
    }
  };

  // 1. Couverture
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, L, H, "F");
  if (logo) doc.addImage(logo, "PNG", 56, 90, 120, 120, "logo", "FAST");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(44);
  doc.text("Charte graphique", 56, 300);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(15);
  doc.setTextColor(200, 196, 235);
  doc.text("Logo, couleurs, typographie et style de Gozly", 56, 330);
  degrade(56, 360, 200, 6);
  doc.setFontSize(10);
  doc.text("gozly.net/marque", 56, H - 56);

  // 2. Logo
  doc.addPage();
  titre("Logo");
  let y = paragraphe("Le G de Gozly accompagne toujours le nom ecrit en Fredoka. Il s'utilise sur fond fonce comme sur fond clair.", 110);
  doc.setFillColor(...NAVY);
  doc.roundedRect(56, y + 10, 230, 150, 14, 14, "F");
  doc.setFillColor(244, 243, 251);
  doc.roundedRect(L - 56 - 230, y + 10, 230, 150, 14, 14, "F");
  doc.setDrawColor(215, 215, 228);
  doc.roundedRect(L - 56 - 230, y + 10, 230, 150, 14, 14, "S");
  if (logo) {
    doc.addImage(logo, "PNG", 56 + 75, y + 35, 100, 100, "logo", "FAST");
    doc.addImage(logo, "PNG", L - 56 - 230 + 65, y + 35, 100, 100, "logo", "FAST");
  }
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Sur fond fonce", 56, y + 176);
  doc.text("Sur fond clair", L - 56 - 230, y + 176);
  y = paragraphe("A respecter", y + 220, 13, 20);
  for (const r of [
    "Garder un espace libre autour du logo, au moins egal a la moitie de sa hauteur.",
    "Ne pas le deformer, ne pas le faire pivoter et ne pas en changer les couleurs.",
    "Sur une photo ou un fond charge, le placer sur une zone calme et assez contrastee.",
  ])
    y = paragraphe("- " + r, y, 11);

  // 3. Couleurs
  doc.addPage();
  titre("Couleurs");
  y = paragraphe("Un fond sombre, des elements plus clairs et un degrade signature du cyan au rose.", 110);
  y += 8;
  const ligneCouleur = (c) => {
    doc.setFillColor(...rgb(c.hex));
    doc.roundedRect(56, y, 44, 30, 7, 7, "F");
    doc.setDrawColor(215, 215, 228);
    doc.roundedRect(56, y, 44, 30, 7, 7, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(propre(c.nom), 112, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`${c.hex.toUpperCase()}   RGB ${rgb(c.hex).join(", ")}`, 112, y + 25);
    doc.setTextColor(70);
    doc.text(propre(c.role), 300, y + 18, { maxWidth: L - 300 - 56 });
    y += 42;
  };
  for (const [nom, liste] of [["Couleurs principales", COULEURS.principales], ["Fonds", COULEURS.fonds], ["Texte", COULEURS.texte]]) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...VIOLET);
    doc.text(nom, 56, y + 4);
    y += 16;
    liste.forEach(ligneCouleur);
    y += 6;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...VIOLET);
  doc.text("Degrade signature", 56, y + 4);
  degrade(56, y + 14, L - 112, 22);

  // 4. Typographie
  doc.addPage();
  titre("Typographie");
  y = paragraphe("Deux polices gratuites (Google Fonts) : une ronde et chaleureuse pour les titres, une lisible pour tout le reste.", 110);
  y += 14;
  for (const p of POLICES) {
    doc.setFillColor(244, 243, 251);
    doc.roundedRect(56, y, L - 112, 118, 14, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(40);
    doc.setTextColor(...NAVY);
    doc.text("Aa", 80, y + 62);
    doc.setFontSize(18);
    doc.text(p.nom, 160, y + 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(propre(p.usage), 160, y + 60);
    doc.text(propre(p.graisses), 160, y + 76);
    doc.setTextColor(...VIOLET);
    doc.text(p.lien, 160, y + 98);
    y += 134;
  }
  doc.setTextColor(0);

  // 5. Style
  doc.addPage();
  titre("Style");
  y = paragraphe("Un fond sombre, des surfaces de verre depoli, des boutons mats avec un leger degrade et des angles bien arrondis.", 110);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...VIOLET);
  doc.text("Themes du tableau de bord", 56, y);
  y += 14;
  THEMES.forEach((th, i) => {
    const x = 56 + (i % 3) * 170;
    const yy = y + Math.floor(i / 3) * 78;
    doc.setFillColor(...rgb(th.fond));
    doc.roundedRect(x, yy, 156, 64, 12, 12, "F");
    doc.setFillColor(...rgb(th.accent));
    doc.roundedRect(x + 14, yy + 38, 70, 16, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(rgb(th.fond).reduce((s, v) => s + v, 0) > 480 ? 20 : 255);
    doc.text(th.nom, x + 14, yy + 22);
  });
  doc.setTextColor(0);

  // pied de page
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Gozly - charte graphique - ${i}/${pages}`, L - 56, H - 30, { align: "right" });
  }

  doc.save("Gozly-charte-graphique.pdf");
}
