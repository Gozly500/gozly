// Aperçu d'un bon de commande : transforme le XML ePOS-Print envoyé à l'imprimante Epson
// (voir lib/impressionCommandes.js) en lignes à afficher à l'écran, avec leur style
// (gras, gros caractères, alignement). Aucun accès serveur : utilisable côté navigateur.

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

// Retourne [{ texte, gras, grand, align }] ; { coupe: true } marque la coupe du papier.
export function xmlVersLignes(xml) {
  const lignes = [];
  const etat = { gras: false, grand: false, align: "left" };
  const jetons = /<text\b([^>]*?)\/>|<text>([\s\S]*?)<\/text>|<feed\s+line="(\d+)"\s*\/>|<cut\b[^>]*\/>/g;
  let m;
  while ((m = jetons.exec(xml))) {
    if (m[1] !== undefined) {
      // <text .../> : change le style des lignes suivantes.
      const em = attribut(m[1], "em");
      const align = attribut(m[1], "align");
      const largeur = attribut(m[1], "width");
      if (em !== null) etat.gras = em === "true";
      if (align) etat.align = align;
      if (largeur !== null) etat.grand = Number(largeur) > 1;
    } else if (m[2] !== undefined) {
      const contenu = decoder(m[2]);
      const morceaux = contenu.split("\n");
      if (morceaux[morceaux.length - 1] === "") morceaux.pop();
      for (const texte of morceaux) lignes.push({ texte, gras: etat.gras, grand: etat.grand, align: etat.align });
    } else if (m[3] !== undefined) {
      for (let i = 0; i < Number(m[3]); i++) lignes.push({ texte: "", gras: false, grand: false, align: "left" });
    } else {
      lignes.push({ coupe: true });
    }
  }
  return lignes;
}
