// Charte graphique de Gozly en PDF, générée dans le navigateur (jsPDF est chargé à la demande). Mêmes données que la page /marque.
// Les exemples (logo étiré, pivoté, recoloré...) sont dessinés pour de vrai à partir du logo : on voit ce qu'il ne faut pas faire.

import { COULEURS, DEGRADE_SIGNATURE, POLICES, THEMES, rgb } from "@/lib/marque";

const NAVY = rgb("#0d0d3f");
const VIOLET = rgb("#7a3fe0");
const CLAIR = [244, 243, 251];
const BORDURE = [215, 215, 228];
const ROUGE = [220, 60, 70];
const VERT = [40, 170, 110];

const chargerImage = (src) =>
  new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });

// Le SVG du logo est converti en PNG (jsPDF n'insère pas de SVG) : dessiné dans un canvas, puis recadré sur le logo lui-même
// (le fichier source a une grande marge vide autour).
async function logoEnPng() {
  try {
    const texte = await (await fetch("/gozly-logo.svg")).text();
    const svg = texte.replace('width="100%"', 'width="1200"').replace('height="100%"', 'height="1200"');
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = await chargerImage(url);
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

// Une copie du logo retouchée (mauvaise couleur, ombre...) : sert aux exemples « à ne pas faire ».
async function variante(png, dessiner) {
  const img = await chargerImage(png);
  const c = document.createElement("canvas");
  c.width = 400;
  c.height = 400;
  dessiner(c.getContext("2d"), img);
  return c.toDataURL("image/png");
}

// Logo + nom « Gozly » en Fredoka côte à côte (le nom est dessiné avec la police de la page). Retourne { png, ratio } (largeur/hauteur).
async function logoAvecNom(png, couleurTexte) {
  try {
    await document.fonts.load("600 200px Fredoka");
  } catch {}
  const img = await chargerImage(png);
  const mesure = document.createElement("canvas").getContext("2d");
  mesure.font = "600 230px Fredoka, 'Fredoka One', sans-serif";
  const largeurTexte = Math.ceil(mesure.measureText("Gozly").width);
  const c = document.createElement("canvas");
  c.width = 400 + 40 + largeurTexte;
  c.height = 400;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, 400, 400);
  ctx.font = "600 230px Fredoka, 'Fredoka One', sans-serif";
  ctx.fillStyle = couleurTexte;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Gozly", 440, 275);
  return { png: c.toDataURL("image/png"), ratio: c.width / c.height };
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
  const M = 56; // marge
  const logo = await logoEnPng();

  // Variantes du logo (si le logo n'a pas pu être chargé, on saute les exemples dessinés)
  let recolore = null, ombre = null, pivote = null, fondCharge = null, nomSombre = null, nomClair = null;
  if (logo) {
    recolore = await variante(logo, (ctx, img) => {
      ctx.filter = "hue-rotate(150deg) saturate(1.8)";
      ctx.drawImage(img, 0, 0, 400, 400);
    });
    ombre = await variante(logo, (ctx, img) => {
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 26;
      ctx.shadowOffsetX = 18;
      ctx.shadowOffsetY = 18;
      ctx.drawImage(img, 20, 20, 330, 330);
    });
    pivote = await variante(logo, (ctx, img) => {
      ctx.translate(200, 200);
      ctx.rotate((32 * Math.PI) / 180);
      ctx.drawImage(img, -145, -145, 290, 290);
    });
    // fond « chargé » : bandes de couleurs vives, coins arrondis, avec le logo par-dessus
    fondCharge = await (async () => {
      const c = document.createElement("canvas");
      c.width = 480;
      c.height = 400;
      const ctx = c.getContext("2d");
      ctx.beginPath();
      ctx.roundRect(0, 0, 480, 400, 36);
      ctx.clip();
      ["#ffc850", "#3cbee6", "#ec4899", "#7846dc", "#ffc850", "#3cbee6", "#ec4899", "#7846dc"].forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.fillRect(i * 60, 0, 61, 400);
      });
      const img = await chargerImage(logo);
      ctx.drawImage(img, 120, 80, 240, 240);
      return c.toDataURL("image/png");
    })();
    nomSombre = await logoAvecNom(logo, "#ffffff");
    nomClair = await logoAvecNom(logo, "#0d0d3f");
  }

  // ---------- petits outils de dessin ----------
  const titre = (texte, y = 70) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(...NAVY);
    doc.text(propre(texte), M, y);
    doc.setFillColor(...VIOLET);
    doc.roundedRect(M, y + 10, 46, 4, 2, 2, "F");
    doc.setTextColor(0);
  };
  const sousTitre = (texte, y, couleur = VIOLET) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...couleur);
    doc.text(propre(texte), M, y);
    doc.setTextColor(0);
  };
  const paragraphe = (texte, y, taille = 11, couleur = 70, x = M, largeur = L - 2 * M) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(taille);
    doc.setTextColor(couleur);
    const lignes = doc.splitTextToSize(propre(texte), largeur);
    doc.text(lignes, x, y);
    doc.setTextColor(0);
    return y + lignes.length * (taille + 4);
  };
  const legende = (texte, x, y, largeur, couleur = 100, aligne = "center") => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(couleur);
    doc.text(doc.splitTextToSize(propre(texte), largeur), aligne === "center" ? x + largeur / 2 : x, y, { align: aligne });
    doc.setTextColor(0);
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
  const tuile = (x, y, w, h, fond) => {
    doc.setFillColor(...fond);
    doc.roundedRect(x, y, w, h, 12, 12, "F");
    if (fond === CLAIR) {
      doc.setDrawColor(...BORDURE);
      doc.roundedRect(x, y, w, h, 12, 12, "S");
    }
  };
  // Pastille ✓ (à faire) ou ✕ (à éviter) dans le coin d'une tuile.
  const pastille = (x, y, bon) => {
    doc.setFillColor(...(bon ? VERT : ROUGE));
    doc.circle(x, y, 9, "F");
    doc.setDrawColor(255);
    doc.setLineWidth(1.8);
    if (bon) {
      doc.line(x - 4, y, x - 1, y + 3);
      doc.line(x - 1, y + 3, x + 4.5, y - 3.5);
    } else {
      doc.line(x - 3.5, y - 3.5, x + 3.5, y + 3.5);
      doc.line(x + 3.5, y - 3.5, x - 3.5, y + 3.5);
    }
    doc.setLineWidth(0.6);
  };
  const image = (png, x, y, w, h) => png && doc.addImage(png, "PNG", x, y, w, h, undefined, "FAST");

  // ---------- 1. Couverture ----------
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, L, H, "F");
  if (nomSombre) image(nomSombre.png, M, 96, 150 * nomSombre.ratio, 150);
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(44);
  doc.text("Charte graphique", M, 340);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(15);
  doc.setTextColor(200, 196, 235);
  doc.text("Logo, couleurs, typographie et style de Gozly", M, 370);
  degrade(M, 400, 200, 6);
  doc.setFontSize(10);
  doc.text("gozly.net/marque", M, H - 56);

  // ---------- 2. Logo : les versions ----------
  doc.addPage();
  titre("Logo");
  let y = paragraphe("Le logo de Gozly est composé du G et du nom, écrit en Fredoka. Utilise toujours les fichiers du kit de marque : ne le redessine pas et ne le retape pas.", 110);

  sousTitre("Logo complet : à utiliser en priorité", y + 14);
  y += 28;
  const wT = (L - 2 * M - 16) / 2;
  tuile(M, y, wT, 130, NAVY);
  tuile(M + wT + 16, y, wT, 130, CLAIR);
  if (nomSombre) {
    const w = 190;
    image(nomSombre.png, M + (wT - w) / 2, y + 65 - w / nomSombre.ratio / 2, w, w / nomSombre.ratio);
    image(nomClair.png, M + wT + 16 + (wT - w) / 2, y + 65 - w / nomClair.ratio / 2, w, w / nomClair.ratio);
  }
  pastille(M + wT - 14, y + 16, true);
  pastille(M + 2 * wT + 2, y + 16, true);
  legende("Sur fond foncé", M, y + 148, wT);
  legende("Sur fond clair", M + wT + 16, y + 148, wT);
  y += 176;

  sousTitre("Symbole seul : espaces restreints", y);
  y += 14;
  tuile(M, y, wT, 110, NAVY);
  tuile(M + wT + 16, y, wT, 110, CLAIR);
  image(logo, M + (wT - 70) / 2, y + 20, 70, 70);
  image(logo, M + wT + 16 + (wT - 70) / 2, y + 20, 70, 70);
  legende("Icône d'application, avatar, favicon", M, y + 128, wT);
  legende("Seulement quand le nom est déjà écrit à côté", M + wT + 16, y + 128, wT);
  y += 160;
  paragraphe("Dans les titres et les textes, le nom s'écrit « Gozly » avec un G majuscule et le reste en minuscules, jamais « GOZLY » ni « gozly ».", y, 10.5);

  // ---------- 3. Espace libre et taille minimale ----------
  doc.addPage();
  titre("Espace libre et taille minimale");
  y = paragraphe("Laisse toujours de l'air autour du logo : un espace au moins égal à la moitié de la hauteur du G, de chaque côté. Aucun texte, aucune image ni aucun bord de page ne doit y entrer.", 110);

  const hx = 70; // hauteur du logo dans le schéma
  const mx = hx / 2; // marge = moitié de la hauteur
  const wLogo = nomClair ? hx * nomClair.ratio : hx;
  const boxW = wLogo + 2 * mx;
  const bx = M + (L - 2 * M - boxW) / 2 - 60, by = y - 6;
  tuile(M, y + 8, L - 2 * M, 200, CLAIR);
  doc.setDrawColor(...VIOLET);
  doc.setLineWidth(0.9);
  doc.setLineDashPattern([4, 3], 0);
  doc.rect(bx + 60, by + 30, wLogo + 2 * mx, hx + 2 * mx);
  doc.setLineDashPattern([], 0);
  doc.setLineWidth(0.6);
  image(nomClair?.png, bx + 60 + mx, by + 30 + mx, wLogo, hx);
  // repères de la marge « x » (carrés violets) sur les 4 côtés
  doc.setFillColor(...VIOLET);
  const px = bx + 60, py = by + 30;
  doc.rect(px, py + mx + hx / 2 - mx / 2, mx, mx, "F");
  doc.rect(px + mx + wLogo, py + mx + hx / 2 - mx / 2, mx, mx, "F");
  doc.rect(px + mx + wLogo / 2 - mx / 2, py, mx, mx, "F");
  doc.rect(px + mx + wLogo / 2 - mx / 2, py + mx + hx, mx, mx, "F");
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  for (const [cx, cy] of [[px + mx / 2, py + mx + hx / 2], [px + mx + wLogo + mx / 2, py + mx + hx / 2], [px + mx + wLogo / 2, py + mx / 2], [px + mx + wLogo / 2, py + mx + hx + mx / 2]]) doc.text("x", cx, cy + 3, { align: "center" });
  doc.setTextColor(0);
  legende("x = la moitié de la hauteur du logo", M, y + 8 + 186, L - 2 * M, 100);
  y += 236;

  sousTitre("Taille minimale", y);
  y += 16;
  const tailles = [["Symbole seul", 24, "24 px à l'écran · 8 mm imprimé"], ["Logo complet", 28, "28 px de haut à l'écran · 10 mm imprimé"]];
  tuile(M, y, L - 2 * M, 116, CLAIR);
  if (nomClair) {
    image(logo, M + 40, y + 36, 24, 24);
    legende(tailles[0][0] + " : " + tailles[0][2], M + 20, y + 84, 200, 90, "left");
    image(nomClair.png, M + 290, y + 34, 28 * nomClair.ratio, 28);
    legende(tailles[1][0] + " : " + tailles[1][2], M + 270, y + 84, 230, 90, "left");
  }
  y += 140;
  paragraphe("En dessous de ces tailles, le G devient illisible : utilise alors le symbole seul, ou agrandis le logo.", y, 10.5);

  // ---------- 4. À ne pas faire ----------
  doc.addPage();
  titre("À ne pas faire");
  y = paragraphe("Voici les erreurs les plus fréquentes. Dans tous les cas, repars du fichier original du kit de marque.", 110);
  y += 8;
  const cw = (L - 2 * M - 2 * 14) / 3;
  const ch = 150;
  const exemples = [
    { texte: "Ne pas étirer ni écraser le logo", fond: NAVY, dessin: (x, yy) => image(logo, x + (cw - 112) / 2, yy + 30, 112, 70) },
    { texte: "Ne pas le faire pivoter", fond: NAVY, dessin: (x, yy) => image(pivote, x + (cw - 86) / 2, yy + 22, 86, 86) },
    { texte: "Ne pas changer ses couleurs", fond: NAVY, dessin: (x, yy) => image(recolore, x + (cw - 78) / 2, yy + 28, 78, 78) },
    { texte: "Ne pas ajouter d'ombre ni d'effet", fond: CLAIR, dessin: (x, yy) => image(ombre, x + (cw - 86) / 2, yy + 24, 86, 86) },
    { texte: "Ne pas le placer sur un fond chargé", fond: null, dessin: (x, yy) => image(fondCharge, x, yy, cw, 130) },
    {
      texte: "Ne pas le mettre sur un fond sans contraste",
      fond: [110, 60, 210],
      dessin: (x, yy) => image(logo, x + (cw - 70) / 2, yy + 30, 70, 70),
    },
  ];
  exemples.forEach((e, i) => {
    const x = M + (i % 3) * (cw + 14);
    const yy = y + Math.floor(i / 3) * (ch + 26);
    // le fond « chargé » est découpé par une tuile arrondie : on dessine d'abord la tuile, puis le motif à l'intérieur
    if (e.fond) tuile(x, yy, cw, 130, e.fond);
    if (logo) e.dessin(x, yy);
    pastille(x + cw - 14, yy + 16, false);
    legende(e.texte, x, yy + 148, cw);
  });
  y += 2 * (ch + 26) + 8;

  sousTitre("À faire", y, VERT);
  y += 14;
  [
    { fond: NAVY, png: nomSombre, texte: "Logo clair sur fond foncé" },
    { fond: CLAIR, png: nomClair, texte: "Logo foncé sur fond clair" },
    { fond: rgb("#221f8a"), png: nomSombre, texte: "Logo clair sur le bleu indigo de la marque" },
  ].forEach((e, i) => {
    const x = M + i * (cw + 14);
    tuile(x, y, cw, 90, e.fond);
    if (e.png) image(e.png.png, x + (cw - 110) / 2, y + 45 - 110 / e.png.ratio / 2, 110, 110 / e.png.ratio);
    pastille(x + cw - 14, y + 16, true);
    legende(e.texte, x, y + 108, cw);
  });
  y += 140;
  paragraphe("Pour un bon contraste, le logo clair va sur fond foncé et le logo foncé sur fond clair. Sur une photo, choisis une zone calme.", y, 10.5);

  // ---------- 5. Couleurs ----------
  doc.addPage();
  titre("Couleurs");
  y = paragraphe("Un fond sombre, des éléments plus clairs et un dégradé signature du cyan au rose.", 110) + 8;
  const ligneCouleur = (c) => {
    doc.setFillColor(...rgb(c.hex));
    doc.roundedRect(M, y, 44, 30, 7, 7, "F");
    doc.setDrawColor(...BORDURE);
    doc.roundedRect(M, y, 44, 30, 7, 7, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text(propre(c.nom), M + 56, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`${c.hex.toUpperCase()}   RGB ${rgb(c.hex).join(", ")}`, M + 56, y + 25);
    doc.setTextColor(70);
    doc.text(propre(c.role), 300, y + 18, { maxWidth: L - 300 - M });
    y += 42;
  };
  for (const [nom, liste] of [["Couleurs principales", COULEURS.principales], ["Fonds", COULEURS.fonds], ["Texte", COULEURS.texte]]) {
    sousTitre(nom, y + 4);
    y += 16;
    liste.forEach(ligneCouleur);
    y += 6;
  }
  sousTitre("Dégradé signature", y + 4);
  degrade(M, y + 14, L - 2 * M, 22);

  // ---------- 6. Typographie ----------
  doc.addPage();
  titre("Typographie");
  y = paragraphe("Deux polices gratuites (Google Fonts) : une ronde et chaleureuse pour les titres, une lisible pour tout le reste.", 110) + 14;
  for (const p of POLICES) {
    tuile(M, y, L - 2 * M, 118, CLAIR);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(40);
    doc.setTextColor(...NAVY);
    doc.text("Aa", M + 24, y + 62);
    doc.setFontSize(18);
    doc.text(p.nom, M + 104, y + 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(propre(p.usage), M + 104, y + 60);
    doc.text(propre(p.graisses), M + 104, y + 76);
    doc.setTextColor(...VIOLET);
    doc.text(p.lien, M + 104, y + 98);
    y += 134;
  }
  sousTitre("Hiérarchie", y + 6);
  y += 22;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Titre de page (Fredoka SemiBold)", M, y + 14);
  doc.setFontSize(15);
  doc.text("Sous-titre (Fredoka SemiBold)", M, y + 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(70);
  doc.text("Texte courant (Inter Regular) : lisible, simple, jamais en majuscules.", M, y + 64);
  doc.setTextColor(0);

  // ---------- 7. Style ----------
  doc.addPage();
  titre("Style");
  y = paragraphe("Un fond sombre, des surfaces de verre dépoli, des boutons mats avec un léger dégradé et des angles bien arrondis.", 110) + 14;
  sousTitre("Thèmes du tableau de bord", y);
  y += 14;
  THEMES.forEach((th, i) => {
    const x = M + (i % 3) * 170;
    const yy = y + Math.floor(i / 3) * 78;
    doc.setFillColor(...rgb(th.fond));
    doc.roundedRect(x, yy, 156, 64, 12, 12, "F");
    if (th.id === "clair") {
      doc.setDrawColor(...BORDURE);
      doc.roundedRect(x, yy, 156, 64, 12, 12, "S");
    }
    doc.setFillColor(...rgb(th.accent));
    doc.roundedRect(x + 14, yy + 38, 70, 16, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(th.id === "clair" ? 20 : 255);
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
    doc.text(`Gozly - charte graphique - ${i}/${pages}`, L - M, H - 30, { align: "right" });
  }

  doc.save("Gozly-charte-graphique.pdf");
}
