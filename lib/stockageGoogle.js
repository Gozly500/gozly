// Google Drive (connexion OAuth 2.0, portée limitée aux fichiers créés par Gozly : drive.file).
// Configuration : GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET (client OAuth « Application Web » de la console Google Cloud).
// L'adresse de redirection enregistrée chez Google doit être exactement <origine du site>/api/stockage/google/callback.

const AUTORISATION = "https://accounts.google.com/o/oauth2/v2/auth";
const JETON = "https://oauth2.googleapis.com/token";
const DRIVE = "https://www.googleapis.com/drive/v3";
const DRIVE_ENVOI = "https://www.googleapis.com/upload/drive/v3";
const PORTEES = "https://www.googleapis.com/auth/drive.file openid email";
const TYPE_DOSSIER = "application/vnd.google-apps.folder";

export function googleConfigure() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function urlAutorisation({ redirectUri, etat }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: PORTEES,
    state: etat,
    // offline + consent : sans ça, Google ne renvoie pas de jeton d'actualisation (indispensable pour les exports automatiques).
    access_type: "offline",
    prompt: "consent select_account",
  });
  return `${AUTORISATION}?${params}`;
}

async function demanderJeton(corps) {
  const res = await fetch(JETON, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      ...corps,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const erreur = new Error(data.error_description || data.error || "Échec de l'échange de jeton Google.");
    erreur.code = data.error || "jeton";
    throw erreur;
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export function echangerCode({ code, redirectUri }) {
  return demanderJeton({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

// Google ne change pas le jeton d'actualisation : refreshToken reste undefined ici.
export function rafraichirJeton(refreshToken) {
  return demanderJeton({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function lireProfil(accessToken) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.email || data?.name || null;
}

// ---- Fichiers ----
// Avec drive.file, Gozly ne voit que ce qu'il a lui-même créé : on retrouve donc ses dossiers et fichiers par leur nom.

function echapper(nom) {
  return String(nom).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function chercher(accessToken, requete) {
  const params = new URLSearchParams({ q: requete, fields: "files(id,name)", pageSize: "1", spaces: "drive" });
  const res = await fetch(`${DRIVE}/files?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Échec de la recherche dans Google Drive (${res.status}).`);
  const data = await res.json().catch(() => ({}));
  return data.files?.[0]?.id || null;
}

async function dossier(accessToken, nom, parentId) {
  const parent = parentId || "root";
  const existant = await chercher(
    accessToken,
    `name='${echapper(nom)}' and mimeType='${TYPE_DOSSIER}' and '${parent}' in parents and trashed=false`
  );
  if (existant) return existant;

  const res = await fetch(`${DRIVE}/files?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: nom, mimeType: TYPE_DOSSIER, parents: [parent] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error(data?.error?.message || `Échec de la création du dossier Google Drive (${res.status}).`);
  return data.id;
}

// Dépose (ou remplace) un fichier à un chemin comme ["Gozly", "Temperatures", "fiche.csv"] ; crée les dossiers manquants.
export async function deposerFichier(accessToken, segments, contenu, type = "text/csv; charset=utf-8") {
  const nomFichier = segments[segments.length - 1];
  let parentId = null;
  for (const nom of segments.slice(0, -1)) parentId = await dossier(accessToken, nom, parentId);

  const existant = await chercher(accessToken, `name='${echapper(nomFichier)}' and '${parentId}' in parents and trashed=false`);

  const limite = "gozly" + Math.random().toString(36).slice(2);
  const metadonnees = existant ? {} : { name: nomFichier, parents: [parentId] };
  const corps =
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadonnees)}\r\n` +
    `--${limite}\r\nContent-Type: ${type}\r\n\r\n`;
  const octets = Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu, "utf8");

  const url = existant
    ? `${DRIVE_ENVOI}/files/${existant}?uploadType=multipart&fields=id`
    : `${DRIVE_ENVOI}/files?uploadType=multipart&fields=id`;
  const res = await fetch(url, {
    method: existant ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${limite}` },
    body: Buffer.concat([Buffer.from(corps, "utf8"), octets, Buffer.from(`\r\n--${limite}--`, "utf8")]),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Échec de l'envoi vers Google Drive (${res.status}).`);
  }
}

// Trouve le dossier (sans le créer) : id, ou null s'il n'existe pas encore.
async function trouverDossier(accessToken, segments) {
  let parentId = null;
  for (const nom of segments) {
    const parent = parentId || "root";
    parentId = await chercher(accessToken, `name='${echapper(nom)}' and mimeType='${TYPE_DOSSIER}' and '${parent}' in parents and trashed=false`);
    if (!parentId) return null;
  }
  return parentId;
}

// Fichiers d'un dossier (ceux que Gozly y a créés) : [{ id, nom, taille, modifieLe }], du plus récent au plus ancien.
export async function listerFichiers(accessToken, segments) {
  const dossierId = await trouverDossier(accessToken, segments);
  if (!dossierId) return [];
  const params = new URLSearchParams({
    q: `'${dossierId}' in parents and trashed=false and mimeType!='${TYPE_DOSSIER}'`,
    fields: "files(id,name,size,modifiedTime)",
    pageSize: "200",
    orderBy: "modifiedTime desc",
    spaces: "drive",
  });
  const res = await fetch(`${DRIVE}/files?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Échec de la lecture du dossier Google Drive (${res.status}).`);
  return (data.files || []).map((x) => ({ id: x.id, nom: x.name, taille: Number(x.size) || 0, modifieLe: x.modifiedTime }));
}

// Lit un fichier par son id, seulement s'il est bien dans le dossier voulu.
export async function lireFichier(accessToken, segments, id) {
  const entetes = { Authorization: `Bearer ${accessToken}` };
  const dossierId = await trouverDossier(accessToken, segments);
  const infos = await fetch(`${DRIVE}/files/${encodeURIComponent(id)}?fields=id,size,parents`, { headers: entetes });
  if (!infos.ok || !dossierId) throw new Error("Fichier introuvable dans Google Drive.");
  const meta = await infos.json();
  if (!(meta.parents || []).includes(dossierId)) throw new Error("Ce fichier n'est pas dans le dossier Gozly.");
  if (Number(meta.size) > 4 * 1024 * 1024) throw new Error("Le fichier est trop gros.");
  const res = await fetch(`${DRIVE}/files/${encodeURIComponent(id)}?alt=media`, { headers: entetes });
  if (!res.ok) throw new Error(`Échec de la lecture du fichier Google Drive (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}
