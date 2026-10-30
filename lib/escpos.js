// Convertit un bon ePOS-Print XML (voir lib/impressionCommandes.js) en octets ESC/POS, le langage que
// l'imprimante Epson comprend directement (Bluetooth, réseau local). Même mise en page que le bon envoyé
// par Internet : gras, grands caractères, alignement, blanc sur noir, coupe. Aucun accès serveur.

const ESC = 0x1b;
const GS = 0x1d;

function decoder(texte) {
  return texte
    .replace(/&#10;/g, "\n")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function attribut(attributs, nom) {
  const m = attributs.match(new RegExp(`${nom}="([^"]*)"`));
  return m ? m[1] : null;
}

const ALIGNEMENTS = { left: 0, center: 1, right: 2 };

export function xmlVersEscPos(xml) {
  const octets = [ESC, 0x40]; // initialisation de l'imprimante
  let largeur = 1;
  let hauteur = 1;
  const jetons = /<text\b([^>]*?)\/>|<text>([\s\S]*?)<\/text>|<feed\s+line="(\d+)"\s*\/>|<cut\b[^>]*\/>/g;
  let m;
  while ((m = jetons.exec(xml))) {
    if (m[1] !== undefined) {
      // <text .../> : change le style des lignes suivantes.
      const em = attribut(m[1], "em");
      const align = attribut(m[1], "align");
      const w = attribut(m[1], "width");
      const h = attribut(m[1], "height");
      const inverse = attribut(m[1], "reverse");
      if (em !== null) octets.push(ESC, 0x45, em === "true" ? 1 : 0);
      if (align in ALIGNEMENTS) octets.push(ESC, 0x61, ALIGNEMENTS[align]);
      if (w !== null || h !== null) {
        if (w !== null) largeur = Math.min(Math.max(Number(w) || 1, 1), 8);
        if (h !== null) hauteur = Math.min(Math.max(Number(h) || 1, 1), 8);
        octets.push(GS, 0x21, ((largeur - 1) << 4) | (hauteur - 1));
      }
      if (inverse !== null) octets.push(GS, 0x42, inverse === "true" ? 1 : 0);
    } else if (m[2] !== undefined) {
      for (const c of decoder(m[2])) {
        const code = c.charCodeAt(0);
        octets.push(code === 0x0a || (code >= 0x20 && code < 0x7f) ? code : 0x3f); // ASCII seulement, le reste devient « ? »
      }
    } else if (m[3] !== undefined) {
      octets.push(ESC, 0x64, Math.min(Number(m[3]), 255)); // avance le papier de n lignes
    } else {
      octets.push(GS, 0x56, 0x42, 0x00); // avance jusqu'à la lame puis coupe
    }
  }
  return Uint8Array.from(octets);
}

export function octetsVersBase64(octets) {
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}
