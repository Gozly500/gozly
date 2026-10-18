import { createClient } from "@supabase/supabase-js";
import { discord } from "@/lib/discordTickets";

// Annonces du site : table annonces_site + images dans le dossier public « annonces » (Supabase Storage).
// Une annonce peut aussi être envoyée dans un salon Discord (message de Gozyx qui renvoie vers la page du site).

export const SITE = "https://gozly.net";
export const BUCKET = "annonces";
export const TYPES_IMAGE = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
export const TAILLE_MAX_IMAGE = 4 * 1024 * 1024; // limite des fonctions Vercel (~4,5 Mo par requête)
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Client sans cache (Next.js met sinon en cache les lectures et une nouvelle annonce n'apparaîtrait pas).
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { global: { fetch: (u, o) => fetch(u, { ...o, cache: "no-store" }) } });
}

export function messageTable(error) {
  return /annonces_site/.test(error?.message || "") ? "La base n'est pas prête (SQL annonces_site.sql à exécuter)." : error?.message || "Erreur.";
}

// Annonces publiées (les plus récentes d'abord).
export async function annoncesPubliees(limite = 20) {
  const service = db();
  if (!service) return { annonces: [], erreur: "Configuration manquante." };
  const { data, error } = await service
    .from("annonces_site")
    .select("id, titre, contenu, image_url, publie_le")
    .eq("publie", true)
    .order("publie_le", { ascending: false })
    .limit(limite);
  if (error) return { annonces: [], erreur: messageTable(error) };
  return { annonces: data || [], erreur: null };
}

// ---------- Images ----------
export async function envoyerImage(service, fichier) {
  const chemin = `${new Date().getFullYear()}/${crypto.randomUUID()}.${TYPES_IMAGE[fichier.type]}`;
  const octets = Buffer.from(await fichier.arrayBuffer());
  const { error } = await service.storage.from(BUCKET).upload(chemin, octets, { contentType: fichier.type, upsert: false });
  if (error) throw new Error(`Image : ${error.message}`);
  const { data } = service.storage.from(BUCKET).getPublicUrl(chemin);
  return { image_url: data.publicUrl, image_chemin: chemin };
}

export async function supprimerImage(service, chemin) {
  if (!chemin) return;
  try {
    await service.storage.from(BUCKET).remove([chemin]);
  } catch {}
}

// ---------- Discord ----------
// roleIds : rôles à notifier (mentions). Sans rôle, le message ne notifie personne.
export function messageDiscord(a, roleIds = []) {
  const contenu = String(a.contenu || "");
  return {
    content: roleIds.length ? roleIds.map((id) => `<@&${id}>`).join(" ") : undefined,
    embeds: [
      {
        title: String(a.titre).slice(0, 250),
        url: `${SITE}/annonces#a-${a.id}`,
        description: contenu.length > 3400 ? `${contenu.slice(0, 3400)}…\n\n[Lire la suite sur gozly.net](${SITE}/annonces#a-${a.id})` : contenu || undefined,
        color: 0x2a38ea,
        image: a.image_url ? { url: a.image_url } : undefined,
        footer: { text: "Annonce Gozly • gozly.net/annonces" },
        timestamp: a.publie_le || new Date().toISOString(),
      },
    ],
    // Seuls les rôles choisis sont mentionnés (jamais @everyone).
    allowed_mentions: roleIds.length ? { roles: roleIds } : { parse: [] },
  };
}

// Salon par défaut des annonces : le premier salon dont le nom contient « annonce » (et pas « statut »).
export async function salonAnnoncesParDefaut() {
  const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
  if (!guildId || !process.env.DISCORD_BOT_TOKEN) return null;
  try {
    const salons = await discord("GET", `/guilds/${guildId}/channels`);
    return salons.find((c) => (c.type === 0 || c.type === 5) && norm(c.name).includes("annonce") && !norm(c.name).includes("statut"))?.id || null;
  } catch {
    return null;
  }
}

// Envoie (ou met à jour) l'annonce dans Discord. Retourne { canal, message }.
// roleIds : rôles à notifier. Avec des rôles, on poste TOUJOURS un nouveau message (une modification ne notifie pas)
// et l'ancien message de cette annonce est supprimé pour éviter les doublons.
export async function publierSurDiscord(service, annonce, canalId, roleIds = []) {
  const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
  if (!guildId || !process.env.DISCORD_BOT_TOKEN) throw new Error("Discord n'est pas configuré (DISCORD_GUILD_ID / DISCORD_BOT_TOKEN).");
  const canal = canalId || annonce.discord_canal_id;
  if (!/^\d+$/.test(String(canal || ""))) throw new Error("Choisis un salon Discord.");
  const salon = await discord("GET", `/channels/${canal}`);
  if (salon.guild_id !== guildId || ![0, 5].includes(salon.type)) throw new Error("Salon Discord invalide.");

  const roles = [...new Set((roleIds || []).map(String))];
  if (roles.length) {
    const existants = await discord("GET", `/guilds/${guildId}/roles`);
    if (!roles.every((id) => existants.some((r) => r.id === id))) throw new Error("Rôle Discord invalide.");
  }

  // Même salon et message déjà envoyé, sans notification demandée : on le met à jour au lieu d'en créer un deuxième.
  if (!roles.length && annonce.discord_message_id && annonce.discord_canal_id === canal) {
    try {
      await discord("PATCH", `/channels/${canal}/messages/${annonce.discord_message_id}`, messageDiscord(annonce));
      return { canal, message: annonce.discord_message_id, misAJour: true };
    } catch {}
  }
  const msg = await discord("POST", `/channels/${canal}/messages`, messageDiscord(annonce, roles));
  const { error } = await service.from("annonces_site").update({ discord_canal_id: canal, discord_message_id: msg.id, maj: new Date().toISOString() }).eq("id", annonce.id);
  if (error) throw new Error(messageTable(error));
  if (annonce.discord_message_id) await supprimerSurDiscord(annonce); // remplace l'ancien message
  return { canal, message: msg.id, misAJour: false, notifies: roles.length };
}

export async function supprimerSurDiscord(annonce) {
  if (!annonce.discord_canal_id || !annonce.discord_message_id) return;
  try {
    await discord("DELETE", `/channels/${annonce.discord_canal_id}/messages/${annonce.discord_message_id}`);
  } catch {}
}
