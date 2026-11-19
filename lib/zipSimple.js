// Petit générateur de ZIP sans dépendance (méthode « stored », sans compression : les SVG/PNG du kit sont déjà petits).

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(octets) {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = TABLE[(c ^ octets[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// fichiers : [{ nom: "Dossier/fichier.svg", contenu: Buffer | string }] -> Buffer du ZIP.
export function creerZip(fichiers) {
  const morceaux = [];
  const centrale = [];
  let decalage = 0;
  const m = new Date();
  const heure = (m.getHours() << 11) | (m.getMinutes() << 5) | (m.getSeconds() >> 1);
  const date = ((m.getFullYear() - 1980) << 9) | ((m.getMonth() + 1) << 5) | m.getDate();

  for (const f of fichiers) {
    const nom = Buffer.from(f.nom, "utf8");
    const donnees = Buffer.isBuffer(f.contenu) ? f.contenu : Buffer.from(f.contenu, "utf8");
    const crc = crc32(donnees);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // noms en UTF-8
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(heure, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(donnees.length, 18);
    local.writeUInt32LE(donnees.length, 22);
    local.writeUInt16LE(nom.length, 26);
    local.writeUInt16LE(0, 28);
    morceaux.push(local, nom, donnees);

    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(0, 10);
    c.writeUInt16LE(heure, 12);
    c.writeUInt16LE(date, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(donnees.length, 20);
    c.writeUInt32LE(donnees.length, 24);
    c.writeUInt16LE(nom.length, 28);
    c.writeUInt32LE(decalage, 42);
    centrale.push(c, nom);

    decalage += 30 + nom.length + donnees.length;
  }

  const tailleCentrale = centrale.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(tailleCentrale, 12);
  fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...morceaux, ...centrale, fin]);
}
