import crypto from "crypto";
import { discord } from "@/lib/discordTickets";

// Liaison compte Gozly <-> compte Discord.
// Le bot remet à la personne un lien signé (HMAC) et temporaire : il contient son identifiant Discord
// et une date d'expiration. Rien n'est stocké avant la confirmation sur le site. La clé de signature est
// dérivée du token du bot (aucune variable de plus à configurer).

export const DUREE_LIEN_MS = 15 * 60 * 1000;
const NOM_ROLE = "compte lie";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

function cle() {
  const secret = process.env.DISCORD_BOT_TOKEN;
  if (!secret) return null;
  return crypto.createHash("sha256").update("liaison:" + secret).digest();
}

function signer(corps) {
  return crypto.createHmac("sha256", cle()).update(corps).digest("base64url");
}

export function creerJeton(discordId, nom) {
  const corps = b64({ d: String(discordId), n: String(nom || "").slice(0, 80), e: Date.now() + DUREE_LIEN_MS });
  return `${corps}.${signer(corps)}`;
}

// Retourne { discordId, nom } si le jeton est authentique et non expiré, sinon null.
export function lireJeton(jeton) {
  try {
    if (!cle() || typeof jeton !== "string") return null;
    const [corps, signature] = jeton.split(".");
    if (!corps || !signature) return null;
    const attendu = signer(corps);
    const a = Buffer.from(signature);
    const b = Buffer.from(attendu);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const p = JSON.parse(Buffer.from(corps, "base64url").toString("utf8"));
    if (!/^\d+$/.test(p.d) || !(p.e > Date.now())) return null;
    return { discordId: p.d, nom: p.n || "" };
  } catch {
    return null;
  }
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

async function idRoleCompteLie(guildId) {
  const roles = await discord("GET", `/guilds/${guildId}/roles`);
  return roles.find((r) => norm(r.name) === NOM_ROLE)?.id || null;
}

// Donne (ou retire) le rôle "Compte lié". Retourne "ok", "role-introuvable" ou "membre-absent".
export async function changerRole(discordId, donner) {
  const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
  if (!guildId || !process.env.DISCORD_BOT_TOKEN) return "non-configure";
  const roleId = await idRoleCompteLie(guildId);
  if (!roleId) return "role-introuvable";
  try {
    await discord(donner ? "PUT" : "DELETE", `/guilds/${guildId}/members/${discordId}/roles/${roleId}`);
    return "ok";
  } catch (e) {
    if (/ 404 /.test(e.message)) return "membre-absent";
    throw e;
  }
}

// Lien (ou délien) enregistré côté base : service_role seulement.
export async function enregistrerLiaison(service, userId, discordId) {
  if (discordId) {
    // Un identifiant Discord n'appartient qu'à un compte : le plus récent l'emporte.
    await service.from("profils").update({ discord_id: null }).eq("discord_id", discordId).neq("id", userId);
  }
  return service.from("profils").update({ discord_id: discordId || null }).eq("id", userId);
}
