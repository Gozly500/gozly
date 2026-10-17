import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminServer";
import { discord, estFerme } from "@/lib/discordTickets";
import { comptesLies, comptesParUtilisateur } from "@/lib/discordCompte";
import { db, messageTable } from "@/lib/ticketsSite";

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

// Tickets créés depuis le site (table tickets_site) : { tickets, diagnostic }.
async function ticketsDuSite() {
  const service = db();
  if (!service) return { tickets: [], diagnostic: null };
  const { data, error } = await service.from("tickets_site").select("*").order("maj", { ascending: false }).limit(100);
  if (error) return { tickets: [], diagnostic: /tickets_site/.test(error.message) ? "SQL tickets_site.sql pas exécuté : les tickets du site sont indisponibles." : error.message };
  const comptes = await comptesParUtilisateur([...new Set((data || []).map((t) => t.user_id))]);
  return {
    diagnostic: null,
    tickets: (data || []).map((t) => {
      const compte = comptes.get(t.user_id) || null;
      return {
        source: "site",
        id: `site:${t.id}`,
        nom: t.sujet,
        sujet: t.sujet,
        proprietaire: compte?.nom || compte?.courriel || "Client du site",
        ouvertLe: t.created_at,
        ferme: t.statut === "ferme",
        dernierAuteur: t.dernier_auteur,
        url: null,
        compte,
      };
    }),
  };
}

// GET                  : liste des tickets (Discord + site), ouverts et fermés.
// GET ?id=<salon>      : messages d'un ticket Discord (lecture seule).
// GET ?id=site:<uuid>  : messages d'un ticket du site.
// Les tickets Discord sont lus en direct (rien n'est stocké) ; ceux du site sont dans Supabase.
export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const id = new URL(request.url).searchParams.get("id");

  // --- Conversation d'un ticket du site ---
  if (id?.startsWith("site:")) {
    const service = db();
    if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
    const { data, error } = await service.from("tickets_site_messages").select("id, auteur, texte, created_at").eq("ticket_id", id.slice(5)).order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });
    return NextResponse.json({
      messages: (data || []).map((m) => ({
        id: m.id,
        auteur: m.auteur === "equipe" ? "Équipe Gozly" : "Client",
        bot: m.auteur === "equipe",
        date: m.created_at,
        contenu: m.texte,
        embeds: [],
        fichiers: [],
      })),
    });
  }

  const site = await ticketsDuSite();
  const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
  if (!guildId || !process.env.DISCORD_BOT_TOKEN) {
    return NextResponse.json({ configure: false, tickets: site.tickets, diagnosticSite: site.diagnostic });
  }

  try {
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
    const ticketsDiscord = await Promise.all(
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
    const { comptes, diagnostic: diagnosticComptes } = await comptesLies([...new Set(ticketsDiscord.map((t) => t.proprietaireId))]);
    for (const t of ticketsDiscord) t.compte = comptes.get(t.proprietaireId) || null;

    const tickets = [...ticketsDiscord, ...site.tickets].sort((a, b) => (a.ouvertLe < b.ouvertLe ? 1 : -1));
    // Diagnostic : ce que le bot voit sur le serveur (aide à comprendre une liste vide).
    const textes = salons.filter((c) => c.type === 0);
    const diagnostic = {
      salons: salons.length,
      salonsTexte: textes.length,
      avecSujetTicket: textes.filter((c) => /^ticket:\d+$/.test(c.topic || "")).length,
      nomsTicket: textes.filter((c) => /^(ticket|ferme)-/.test(c.name)).map((c) => `${c.name} (sujet: ${c.topic ? "présent" : "vide"})`),
    };
    return NextResponse.json({ configure: true, tickets, diagnostic, diagnosticComptes, diagnosticSite: site.diagnostic });
  } catch (e) {
    const detail = String(e.message).replace(process.env.DISCORD_BOT_TOKEN, "***").slice(0, 300);
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}

// POST { id, texte, mentionner } : réponse à un ticket.
//   - ticket Discord : Gozyx envoie la réponse dans le salon ("mentionner" notifie la personne du ticket).
//   - ticket du site (id "site:<uuid>") : la réponse apparaît dans la conversation, sous « Équipe Gozly ».
// POST { action: "statut", id: "site:<uuid>", ferme: true|false } : ferme ou rouvre un ticket du site.
// POST { action: "supprimer", id } : supprime définitivement un ticket FERMÉ (site : lignes en base ; Discord : le salon).
export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const c = await request.json().catch(() => ({}));
  const texte = String(c.texte || "").trim();

  // --- Tickets du site ---
  if (String(c.id || "").startsWith("site:")) {
    const service = db();
    if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
    const ticketId = c.id.slice(5);
    const { data: ticket } = await service.from("tickets_site").select("*").eq("id", ticketId).maybeSingle();
    if (!ticket) return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });

    if (c.action === "supprimer") {
      if (ticket.statut !== "ferme") return NextResponse.json({ error: "Ferme le ticket avant de le supprimer." }, { status: 409 });
      const { error } = await service.from("tickets_site").delete().eq("id", ticketId); // les messages partent avec (cascade)
      if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    if (c.action === "statut") {
      await service.from("tickets_site").update({ statut: c.ferme ? "ferme" : "ouvert", maj: new Date().toISOString() }).eq("id", ticketId);
      return NextResponse.json({ ok: true });
    }
    if (ticket.statut !== "ouvert") return NextResponse.json({ error: "Ce ticket est fermé : rouvre-le pour continuer la conversation." }, { status: 409 });
    if (!texte) return NextResponse.json({ error: "Écris ta réponse." }, { status: 400 });
    if (texte.length > 2000) return NextResponse.json({ error: "Réponse trop longue (maximum 2000 caractères)." }, { status: 400 });
    const { error } = await service.from("tickets_site_messages").insert({ ticket_id: ticketId, auteur: "equipe", texte });
    if (error) return NextResponse.json({ error: messageTable(error) }, { status: 500 });
    await service.from("tickets_site").update({ dernier_auteur: "equipe", maj: new Date().toISOString() }).eq("id", ticketId);
    return NextResponse.json({ ok: true });
  }

  // --- Tickets Discord ---
  const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
  if (!guildId || !process.env.DISCORD_BOT_TOKEN) return NextResponse.json({ error: "Discord n'est pas configuré." }, { status: 500 });
  if (!/^\d+$/.test(String(c.id || ""))) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });

  if (c.action === "supprimer") {
    try {
      const canal = await discord("GET", `/channels/${c.id}`);
      const m = /^ticket:(\d+)$/.exec(canal.topic || "");
      if (canal.guild_id !== guildId || !m) return NextResponse.json({ error: "Ce salon n'est pas un ticket." }, { status: 404 });
      if (!estFerme(canal, m[1])) return NextResponse.json({ error: "Ferme le ticket avant de le supprimer." }, { status: 409 });
      await discord("DELETE", `/channels/${canal.id}`);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String(e.message).replace(process.env.DISCORD_BOT_TOKEN, "***").slice(0, 300) }, { status: 502 });
    }
  }

  if (!texte) return NextResponse.json({ error: "Écris ta réponse." }, { status: 400 });
  if (texte.length > 1800) return NextResponse.json({ error: "Réponse trop longue (maximum 1800 caractères)." }, { status: 400 });

  try {
    const canal = await discord("GET", `/channels/${c.id}`);
    const m = /^ticket:(\d+)$/.exec(canal.topic || "");
    if (canal.guild_id !== guildId || !m) return NextResponse.json({ error: "Ce salon n'est pas un ticket." }, { status: 404 });
    if (estFerme(canal, m[1])) return NextResponse.json({ error: "Ce ticket est fermé : rouvre-le dans Discord pour continuer la conversation." }, { status: 409 });

    const mentionner = c.mentionner !== false;
    await discord("POST", `/channels/${canal.id}/messages`, {
      content: mentionner ? `<@${m[1]}> ${texte}` : texte,
      // Seule la personne du ticket peut être mentionnée (jamais @everyone, jamais un rôle).
      allowed_mentions: mentionner ? { users: [m[1]] } : { parse: [] },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e.message).replace(process.env.DISCORD_BOT_TOKEN, "***").slice(0, 300) }, { status: 502 });
  }
}
