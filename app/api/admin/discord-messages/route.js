import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminServer";
import { discord } from "@/lib/discordTickets";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TAILLE_MAX = 4 * 1024 * 1024; // limite des fonctions Vercel (~4,5 Mo par requête)
const TYPES_IMAGE = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

const COULEURS = { bleu: 0x2a38ea, vert: 0x3c8000, jaune: 0xf5b800, rouge: 0xe5232e, gris: 0x6b7280 };

function config() {
  const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
  return guildId && process.env.DISCORD_BOT_TOKEN ? guildId : null;
}

// GET : salons textuels (groupés par catégorie) et rôles du serveur, pour remplir le formulaire.
export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const guildId = config();
  if (!guildId) return NextResponse.json({ configure: false, salons: [], roles: [] });
  try {
    const [canaux, roles] = await Promise.all([discord("GET", `/guilds/${guildId}/channels`), discord("GET", `/guilds/${guildId}/roles`)]);
    const categories = Object.fromEntries(canaux.filter((c) => c.type === 4).map((c) => [c.id, c]));
    const salons = canaux
      .filter((c) => c.type === 0 || c.type === 5)
      .sort((a, b) => (categories[a.parent_id]?.position ?? -1) - (categories[b.parent_id]?.position ?? -1) || a.position - b.position)
      .map((c) => ({ id: c.id, nom: c.name, categorie: categories[c.parent_id]?.name || "" }));
    return NextResponse.json({
      configure: true,
      salons,
      roles: roles.filter((r) => r.id !== guildId && !r.managed).sort((a, b) => b.position - a.position).map((r) => ({ id: r.id, nom: r.name })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e.message).replace(process.env.DISCORD_BOT_TOKEN, "***").slice(0, 300) }, { status: 502 });
  }
}

// POST { canalId, mode: "embed" | "texte", titre, texte, couleur, image, mention } : envoie le message dans Discord.
// mention : "aucune" | "everyone" | "here" | <identifiant d'un rôle>
export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const guildId = config();
  if (!guildId) return NextResponse.json({ error: "Discord n'est pas configuré." }, { status: 500 });

  // Soit du JSON (lien d'image), soit un formulaire avec une image jointe : { donnees: "<json>", image: <fichier> }.
  let c = {};
  let fichier = null;
  if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
    const f = await request.formData().catch(() => null);
    if (!f) return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
    try {
      c = JSON.parse(String(f.get("donnees") || "{}"));
    } catch {
      return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
    }
    const img = f.get("image");
    if (img && typeof img === "object" && img.size > 0) {
      if (!TYPES_IMAGE[img.type]) return NextResponse.json({ error: "Format d'image non accepté (PNG, JPG, GIF ou WebP)." }, { status: 400 });
      if (img.size > TAILLE_MAX) return NextResponse.json({ error: "Image trop lourde (maximum 4 Mo)." }, { status: 400 });
      fichier = img;
    }
  } else {
    c = await request.json().catch(() => ({}));
  }
  const texte = String(c.texte || "").trim();
  const titre = String(c.titre || "").trim().slice(0, 256);
  const embed = c.mode !== "texte";
  if (!texte) return NextResponse.json({ error: "Écris le message." }, { status: 400 });
  if (texte.length > (embed ? 4000 : 1900)) return NextResponse.json({ error: `Message trop long (maximum ${embed ? 4000 : 1900} caractères).` }, { status: 400 });
  if (!/^\d+$/.test(String(c.canalId || ""))) return NextResponse.json({ error: "Choisis un salon." }, { status: 400 });
  const image = String(c.image || "").trim();
  if (image && !/^https:\/\/\S+$/.test(image)) return NextResponse.json({ error: "L'image doit être un lien https://." }, { status: 400 });

  try {
    // On n'écrit que dans les salons textuels de NOTRE serveur.
    const canal = await discord("GET", `/channels/${c.canalId}`);
    if (canal.guild_id !== guildId || ![0, 5].includes(canal.type)) return NextResponse.json({ error: "Salon invalide." }, { status: 400 });

    let mentionTexte = "";
    let allowed = { parse: [] };
    if (c.mention === "everyone" || c.mention === "here") {
      mentionTexte = `@${c.mention}`;
      allowed = { parse: ["everyone"] };
    } else if (/^\d+$/.test(String(c.mention || ""))) {
      const roles = await discord("GET", `/guilds/${guildId}/roles`);
      if (!roles.some((r) => r.id === c.mention)) return NextResponse.json({ error: "Rôle invalide." }, { status: 400 });
      mentionTexte = `<@&${c.mention}>`;
      allowed = { roles: [c.mention] };
    }

    const corps = embed
      ? {
          content: mentionTexte || undefined,
          allowed_mentions: allowed,
          embeds: [
            {
              title: titre || undefined,
              description: texte,
              color: COULEURS[c.couleur] ?? COULEURS.bleu,
              image: image ? { url: image } : undefined,
              footer: { text: "Gozyx • Gozly" },
            },
          ],
        }
      : { content: [mentionTexte, titre ? `**${titre}**` : "", texte].filter(Boolean).join("\n"), allowed_mentions: allowed };

    let msg;
    if (fichier) {
      // Image jointe : envoi en multipart. Dans un message encadré, l'encadré pointe vers la pièce jointe.
      const nom = `image.${TYPES_IMAGE[fichier.type]}`;
      corps.attachments = [{ id: 0, filename: nom }];
      if (embed) corps.embeds[0].image = { url: `attachment://${nom}` };
      const form = new FormData();
      form.append("payload_json", JSON.stringify(corps));
      form.append("files[0]", fichier, nom);
      const base = process.env.DISCORD_API_BASE || "https://discord.com/api/v10";
      const res = await fetch(`${base}/channels/${canal.id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        body: form,
        cache: "no-store",
      });
      const texteRes = await res.text();
      if (!res.ok) throw new Error(`Discord POST messages -> ${res.status} ${texteRes.slice(0, 200)}`);
      msg = JSON.parse(texteRes);
    } else {
      msg = await discord("POST", `/channels/${canal.id}/messages`, corps);
    }
    return NextResponse.json({ ok: true, url: `https://discord.com/channels/${guildId}/${canal.id}/${msg.id}`, salon: canal.name });
  } catch (e) {
    return NextResponse.json({ error: String(e.message).replace(process.env.DISCORD_BOT_TOKEN, "***").slice(0, 300) }, { status: 502 });
  }
}
