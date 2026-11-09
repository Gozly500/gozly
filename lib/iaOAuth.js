import crypto from "crypto";
import { hashCle, PREFIXE_CLE } from "./iaServer.js";

// OAuth 2.1 pour les assistants IA (norme MCP) : « Se connecter avec Gozly ».
// - Inscription dynamique (RFC 7591) : l'assistant s'enregistre lui-même, sans secret (client public).
// - Autorisation par code + PKCE S256 obligatoire. La page d'autorisation est /connexion-ia (le propriétaire s'y connecte à Gozly).
// - Jetons : accès 1 h + renouvellement 60 jours, stockés en empreintes dans ia_cles (une connexion = une ligne, révocable).

export const PREFIXE_RENOUVELLEMENT = "gozly_ir_";
const DUREE_CODE_MS = 10 * 60 * 1000;
const DUREE_ACCES_S = 60 * 60;
const DUREE_RENOUVELLEMENT_MS = 60 * 24 * 3600 * 1000;

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
};

// Adresse publique du site, telle que vue par le client (derrière le proxy de Vercel).
export function origineDe(request) {
  const h = request.headers;
  const hote = h.get("x-forwarded-host") || h.get("host") || new URL(request.url).host;
  const proto = h.get("x-forwarded-proto") || (/^(localhost|127\.0\.0\.1)/.test(hote) ? "http" : "https");
  return `${proto}://${hote}`;
}

export function metadonneesServeur(origine) {
  return {
    issuer: origine,
    authorization_endpoint: `${origine}/connexion-ia`,
    token_endpoint: `${origine}/api/ia/oauth/token`,
    registration_endpoint: `${origine}/api/ia/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["gozly"],
  };
}

export function metadonneesRessource(origine) {
  return {
    resource: `${origine}/api/ia/mcp`,
    authorization_servers: [origine],
    bearer_methods_supported: ["header"],
    resource_name: "Gozly",
  };
}

const aleatoire = (n) => crypto.randomBytes(n).toString("base64url");

// ---------- Clients (inscription dynamique) ----------

// https partout ; http seulement vers la machine locale (assistants installés sur l'ordinateur).
export function redirectUriValide(uri) {
  if (typeof uri !== "string" || uri.length > 500) return false;
  let u;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash) return false;
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
}

export async function enregistrerClient(service, corps) {
  const uris = Array.isArray(corps?.redirect_uris) ? corps.redirect_uris : [];
  if (uris.length === 0 || uris.length > 5 || !uris.every(redirectUriValide)) {
    return { erreur: "invalid_redirect_uri", description: "redirect_uris doit contenir 1 à 5 adresses https (ou http locale)." };
  }
  const nom = String(corps?.client_name || "Assistant IA")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 80) || "Assistant IA";
  const clientId = "gz_" + crypto.randomBytes(16).toString("hex");
  const { error } = await service.from("ia_oauth_clients").insert({ client_id: clientId, client_nom: nom, redirect_uris: uris });
  if (error) return { erreur: "server_error", description: "Enregistrement impossible." };
  return { client: { client_id: clientId, client_name: nom, redirect_uris: uris } };
}

export async function chargerClient(service, clientId) {
  if (typeof clientId !== "string" || !clientId) return null;
  const { data } = await service.from("ia_oauth_clients").select("client_id, client_nom, redirect_uris").eq("client_id", clientId).maybeSingle();
  return data || null;
}

// ---------- Autorisation ----------

export function pkceValide(verifier, challenge) {
  if (typeof verifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const attendu = crypto.createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(attendu);
  const b = Buffer.from(String(challenge));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function challengeValide(challenge) {
  return typeof challenge === "string" && /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

export function construireRedirection(redirectUri, params) {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
  return u.toString();
}

export async function creerCode(service, { clientId, redirectUri, codeChallenge, entrepriseId, userId, droits }) {
  const code = aleatoire(32);
  const { error } = await service.from("ia_oauth_codes").insert({
    code_hash: hashCle(code),
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    entreprise_id: entrepriseId,
    user_id: userId,
    droits,
    ecriture: droits?.horaire === "ecriture",
    expire_le: new Date(Date.now() + DUREE_CODE_MS).toISOString(),
  });
  if (error) return null;
  return code;
}

// ---------- Jetons ----------

function reponseJetons(acces, renouvellement) {
  return { access_token: acces, token_type: "Bearer", expires_in: DUREE_ACCES_S, refresh_token: renouvellement, scope: "gozly" };
}

function nouveauxJetons() {
  const acces = PREFIXE_CLE + aleatoire(32);
  const renouvellement = PREFIXE_RENOUVELLEMENT + aleatoire(32);
  return {
    acces,
    renouvellement,
    champs: {
      cle_hash: hashCle(acces),
      expire_le: new Date(Date.now() + DUREE_ACCES_S * 1000).toISOString(),
      refresh_hash: hashCle(renouvellement),
      refresh_expire_le: new Date(Date.now() + DUREE_RENOUVELLEMENT_MS).toISOString(),
    },
  };
}

// Échange un code d'autorisation contre des jetons. Retourne { jetons } ou { erreur, description }.
export async function echangerCode(service, { code, clientId, redirectUri, codeVerifier }) {
  if (!code || !clientId || !redirectUri || !codeVerifier) return { erreur: "invalid_request", description: "Paramètres manquants." };

  // Ménage des codes expirés, puis consommation du code (usage unique : la suppression le retourne une seule fois).
  await service.from("ia_oauth_codes").delete().lt("expire_le", new Date().toISOString());
  const { data: lignes } = await service.from("ia_oauth_codes").delete().eq("code_hash", hashCle(code)).select();
  const ligne = lignes && lignes[0];
  if (!ligne || new Date(ligne.expire_le) < new Date()) return { erreur: "invalid_grant", description: "Code invalide ou expiré." };
  if (ligne.client_id !== clientId || ligne.redirect_uri !== redirectUri) return { erreur: "invalid_grant", description: "Code invalide." };
  if (!pkceValide(codeVerifier, ligne.code_challenge)) return { erreur: "invalid_grant", description: "Vérification PKCE échouée." };

  const client = await chargerClient(service, clientId);
  if (!client) return { erreur: "invalid_client", description: "Client inconnu." };

  // Une seule connexion par assistant et par entreprise : l'ancienne est révoquée.
  await service
    .from("ia_cles")
    .update({ revoquee: true })
    .eq("oauth", true)
    .eq("oauth_client_id", clientId)
    .eq("entreprise_id", ligne.entreprise_id)
    .eq("revoquee", false);

  const { acces, renouvellement, champs } = nouveauxJetons();
  const { error } = await service.from("ia_cles").insert({
    entreprise_id: ligne.entreprise_id,
    nom: client.client_nom,
    prefixe: "OAuth",
    ecriture: ligne.droits ? ligne.droits.horaire === "ecriture" : !!ligne.ecriture,
    droits: ligne.droits || null,
    cree_par: ligne.user_id,
    oauth: true,
    oauth_client_id: clientId,
    client_nom: client.client_nom,
    ...champs,
  });
  if (error) return { erreur: "server_error", description: "Création de la connexion impossible." };
  return { jetons: reponseJetons(acces, renouvellement) };
}

// Renouvelle les jetons (le jeton de renouvellement change à chaque fois).
export async function renouveler(service, { refreshToken, clientId }) {
  if (!refreshToken || !String(refreshToken).startsWith(PREFIXE_RENOUVELLEMENT)) return { erreur: "invalid_grant", description: "Jeton de renouvellement invalide." };
  const ancien = hashCle(refreshToken);
  const { data: ligne } = await service.from("ia_cles").select("id, oauth_client_id, refresh_expire_le").eq("refresh_hash", ancien).eq("oauth", true).eq("revoquee", false).maybeSingle();
  if (!ligne || !ligne.refresh_expire_le || new Date(ligne.refresh_expire_le) < new Date()) return { erreur: "invalid_grant", description: "Jeton de renouvellement invalide ou expiré." };
  if (clientId && ligne.oauth_client_id !== clientId) return { erreur: "invalid_grant", description: "Jeton de renouvellement invalide." };

  const { acces, renouvellement, champs } = nouveauxJetons();
  const { data: maj } = await service.from("ia_cles").update(champs).eq("id", ligne.id).eq("refresh_hash", ancien).select("id");
  if (!maj || maj.length === 0) return { erreur: "invalid_grant", description: "Jeton de renouvellement déjà utilisé." };
  return { jetons: reponseJetons(acces, renouvellement) };
}
