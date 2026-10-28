export { signerEtat, lireEtat } from "@/lib/stockageEtat";

// OneDrive via Microsoft Graph (connexion OAuth 2.0, comptes personnels et professionnels).
// Configuration : MICROSOFT_CLIENT_ID et MICROSOFT_CLIENT_SECRET (app « Gozly » enregistrée dans Microsoft Entra).
// L'adresse de redirection enregistrée chez Microsoft doit être exactement
// <origine du site>/api/stockage/microsoft/callback.

const AUTORITE = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH = "https://graph.microsoft.com/v1.0";
const PORTEES = "offline_access User.Read Files.ReadWrite";
const TAILLE_MAX_ENVOI = 4 * 1024 * 1024; // envoi simple de Graph : 4 Mo max

export function microsoftConfigure() {
  return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

// ---- OAuth ----

export function urlAutorisation({ redirectUri, etat }) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: PORTEES,
    state: etat,
    prompt: "select_account",
  });
  return `${AUTORITE}/authorize?${params}`;
}

async function demanderJeton(corps) {
  const res = await fetch(`${AUTORITE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      scope: PORTEES,
      ...corps,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const erreur = new Error(data.error_description || data.error || "Échec de l'échange de jeton Microsoft.");
    erreur.code = data.error || "jeton";
    throw erreur;
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

export function echangerCode({ code, redirectUri }) {
  return demanderJeton({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

// Microsoft renvoie un nouveau jeton d'actualisation à chaque utilisation : il faut garder le plus récent.
export function rafraichirJeton(refreshToken) {
  return demanderJeton({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function lireProfil(accessToken) {
  const res = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName,displayName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  return data.mail || data.userPrincipalName || data.displayName || null;
}

// ---- Fichiers ----

// Dépose (ou remplace) un fichier à un chemin comme ["Gozly", "Temperatures", "fiche.csv"] ; Graph crée les dossiers manquants.
export async function deposerFichier(accessToken, segments, contenu, type = "text/csv; charset=utf-8") {
  const octets = Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu, "utf8");
  if (octets.length > TAILLE_MAX_ENVOI) throw new Error("Le fichier est trop gros pour l'envoi simple.");
  const chemin = segments.map(encodeURIComponent).join("/");
  const res = await fetch(`${GRAPH}/me/drive/root:/${chemin}:/content?@microsoft.graph.conflictBehavior=replace`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": type },
    body: octets,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || `Échec de l'envoi vers OneDrive (${res.status}).`);
  }
}

// Fichiers d'un dossier (ex. ["Gozly", "Documents"]) : [{ id, nom, taille, modifieLe }], du plus récent au plus ancien.
export async function listerFichiers(accessToken, segments) {
  const chemin = segments.map(encodeURIComponent).join("/");
  const params = new URLSearchParams({ $select: "id,name,size,lastModifiedDateTime,file", $top: "200" });
  const res = await fetch(`${GRAPH}/me/drive/root:/${chemin}:/children?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) return []; // le dossier n'existe pas encore : rien d'enregistré
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Échec de la lecture du dossier OneDrive (${res.status}).`);
  return (data.value || [])
    .filter((x) => x.file)
    .map((x) => ({ id: x.id, nom: x.name, taille: x.size, modifieLe: x.lastModifiedDateTime }))
    .sort((a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe)));
}

// Lit un fichier par son id, seulement s'il est bien dans le dossier voulu (Files.ReadWrite donne accès à tout le OneDrive : on ne sort pas du dossier Gozly).
export async function lireFichier(accessToken, segments, id) {
  const entetes = { Authorization: `Bearer ${accessToken}` };
  const infos = await fetch(`${GRAPH}/me/drive/items/${encodeURIComponent(id)}?$select=name,size,parentReference`, { headers: entetes });
  if (!infos.ok) throw new Error("Fichier introuvable dans OneDrive.");
  const meta = await infos.json();
  const attendu = `:/${segments.join("/")}`;
  if (!String(meta?.parentReference?.path || "").endsWith(attendu)) throw new Error("Ce fichier n'est pas dans le dossier Gozly.");
  if (meta.size > TAILLE_MAX_ENVOI) throw new Error("Le fichier est trop gros.");
  const res = await fetch(`${GRAPH}/me/drive/items/${encodeURIComponent(id)}/content`, { headers: entetes, redirect: "follow" });
  if (!res.ok) throw new Error(`Échec de la lecture du fichier OneDrive (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}
