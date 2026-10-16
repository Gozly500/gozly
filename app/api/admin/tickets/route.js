import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminServer";
import { discord, estFerme } from "@/lib/discordTickets";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Date de création d'un identifiant Discord (snowflake).
const dateSnowflake = (id) => new Date(Number((BigInt(id) >> 22n) + 1420070400000n)).toISOString();

async function nomUtilisateur(guildId, id) {
  try {
    const m = await discord("GET", `/guilds/${guildId}/members/${id}`);
    return m.nick || m.user?.global_name || m.user?.username || id;
  } catch {
    try {
      const u = await discord("GET", `/users/${id}`);
      return u.global_name || u.username || id;
    } catch {
      return id;
    }
  }
}

// GET            : liste des tickets Discord (ouverts et fermés).
// GET ?id=<salon>: messages d'un ticket (lecture seule).
// Les tickets Discord sont lus en direct (rien n'est stocké). Plus tard, les tickets du site
// (table Supabase) pourront s'ajouter à cette liste avec source "site".
export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
  if (!guildId || !process.env.DISCORD_BOT_TOKEN) {
    return NextResponse.json({ configure: false, tickets: [] });
  }

  try {
    const id = new URL(request.url).searchParams.get("id");

    if (id) {
      if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
      const canal = await discord("GET", `/channels/${id}`);
      // On ne lit que les salons de tickets de notre serveur.
      if (canal.guild_id !== guildId || !/^ticket:\d+$/.test(canal.topic || "")) {
        return NextResponse.json({ error: "Ce salon n'est pas un ticket." }, { status: 404 });
      }
      const brut = await discord("GET", `/channels/${id}/messages?limit=100`);
      const messages = brut
        .slice()
        .reverse()
        .map((m) => ({
          id: m.id,
          auteur: m.member?.nick || m.author?.global_name || m.author?.username || "?",
          bot: !!m.author?.bot,
          date: m.timestamp,
          contenu: m.content || "",
          embeds: (m.embeds || []).map((e) => [e.title, e.description].filter(Boolean).join(" - ")).filter(Boolean),
          fichiers: (m.attachments || []).map((a) => ({ nom: a.filename, url: a.url })),
        }));
      return NextResponse.json({ messages });
    }

    const salons = await discord("GET", `/guilds/${guildId}/channels`);
    const tickets = await Promise.all(
      salons
        .filter((c) => c.type === 0 && /^ticket:\d+$/.test(c.topic || ""))
        .map(async (c) => {
          const proprietaireId = c.topic.slice("ticket:".length);
          return {
            source: "discord",
            id: c.id,
            nom: c.name,
            proprietaireId,
            proprietaire: await nomUtilisateur(guildId, proprietaireId),
            ouvertLe: dateSnowflake(c.id),
            ferme: estFerme(c, proprietaireId),
            url: `https://discord.com/channels/${guildId}/${c.id}`,
          };
        })
    );
    tickets.sort((a, b) => (a.ouvertLe < b.ouvertLe ? 1 : -1));
    // Diagnostic : ce que le bot voit sur le serveur (aide à comprendre une liste vide).
    const textes = salons.filter((c) => c.type === 0);
    const diagnostic = {
      salons: salons.length,
      salonsTexte: textes.length,
      avecSujetTicket: textes.filter((c) => /^ticket:\d+$/.test(c.topic || "")).length,
      nomsTicket: textes.filter((c) => /^(ticket|ferme)-/.test(c.name)).map((c) => `${c.name} (sujet: ${c.topic ? "présent" : "vide"})`),
    };
    return NextResponse.json({ configure: true, tickets, diagnostic });
  } catch (e) {
    const detail = String(e.message).replace(process.env.DISCORD_BOT_TOKEN, "***").slice(0, 300);
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
