import { createClient } from "@supabase/supabase-js";
import { discord } from "@/lib/discordTickets";
import { idRoleCompteLie } from "@/lib/discordLiaison";

// Votes (référendums) : un message de Gozyx avec les boutons Pour / Contre dans le salon "référendums".
// Les décomptes sont mis à jour en direct dans le message. Les votes sont en base (table votes_discord).

export const ID_VOTE_POUR = "vote_pour";
export const ID_VOTE_CONTRE = "vote_contre";

const API = () => process.env.DISCORD_API_BASE || "https://discord.com/api/v10";
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Client sans cache (Next.js met sinon en cache les lectures et les décomptes resteraient périmés).
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { global: { fetch: (u, o) => fetch(u, { ...o, cache: "no-store" }) } });
}

export async function decomptes(service, voteId) {
  const { data, error } = await service.from("votes_discord_bulletins").select("choix").eq("vote_id", voteId);
  if (error) throw new Error(error.message);
  const pour = (data || []).filter((b) => b.choix === "pour").length;
  return { pour, contre: (data || []).length - pour };
}

function barre(pct) {
  const pleins = Math.round(pct / 10);
  return "▰".repeat(pleins) + "▱".repeat(10 - pleins);
}

// Message Discord du vote (ouvert ou terminé) avec les résultats en direct.
export function messageVote(vote, { pour, contre }) {
  const total = pour + contre;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const lignes =
    `👍 **Pour** : ${pour} (${pct(pour)} %)\n${barre(pct(pour))}\n\n` + `👎 **Contre** : ${contre} (${pct(contre)} %)\n${barre(pct(contre))}`;
  const termine = vote.ferme;
  const fin = vote.fin_le ? Math.floor(new Date(vote.fin_le).getTime() / 1000) : null;
  const pied = [
    `${total} vote${total > 1 ? "s" : ""}`,
    vote.reserve ? "Réservé aux comptes liés" : null,
    termine ? "Vote terminé" : "Vote anonyme",
  ]
    .filter(Boolean)
    .join(" • ");
  return {
    embeds: [
      {
        title: `${termine ? "✅ Terminé : " : "🗳️ "}${vote.titre}`,
        description: [vote.description, lignes, !termine && fin ? `⏳ Fin du vote : <t:${fin}:R>` : null].filter(Boolean).join("\n\n"),
        color: termine ? 0x6b7280 : 0x2a38ea,
        footer: { text: pied },
      },
    ],
    components: termine
      ? []
      : [
          {
            type: 1,
            components: [
              { type: 2, style: 3, label: "Pour", emoji: { name: "👍" }, custom_id: ID_VOTE_POUR },
              { type: 2, style: 4, label: "Contre", emoji: { name: "👎" }, custom_id: ID_VOTE_CONTRE },
            ],
          },
        ],
  };
}

// Salon des référendums : variable DISCORD_CHANNEL_VOTES, sinon le premier salon dont le nom contient "referendum".
async function salonVotes(guildId) {
  const force = (process.env.DISCORD_CHANNEL_VOTES || "").trim();
  if (/^\d+$/.test(force)) return force;
  const salons = await discord("GET", `/guilds/${guildId}/channels`);
  return salons.find((c) => c.type === 0 && norm(c.name).includes("referendum"))?.id || null;
}

// Publie un nouveau vote (appelé depuis le panneau admin).
export async function creerVote(service, { titre, description, dureeHeures, reserve, creePar }) {
  const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
  if (!guildId || !process.env.DISCORD_BOT_TOKEN) throw new Error("Discord n'est pas configuré (DISCORD_GUILD_ID / DISCORD_BOT_TOKEN).");
  const canal = await salonVotes(guildId);
  if (!canal) throw new Error("Salon des référendums introuvable (un salon dont le nom contient « référendum »).");

  const fin_le = dureeHeures > 0 ? new Date(Date.now() + dureeHeures * 3600 * 1000).toISOString() : null;
  const vote = { titre, description, reserve: !!reserve, ferme: false, fin_le };
  const msg = await discord("POST", `/channels/${canal}/messages`, messageVote(vote, { pour: 0, contre: 0 }));
  const { data, error } = await service
    .from("votes_discord")
    .insert({ message_id: msg.id, channel_id: canal, titre, description, reserve: !!reserve, fin_le, cree_par: creePar || null })
    .select()
    .single();
  if (error) {
    await discord("DELETE", `/channels/${canal}/messages/${msg.id}`).catch(() => {});
    throw new Error(/votes_discord/.test(error.message) ? "La base n'est pas prête (SQL votes_discord.sql à exécuter)." : error.message);
  }
  return { ...data, url: `https://discord.com/channels/${guildId}/${canal}/${msg.id}` };
}

// Clôture un vote : retire les boutons et fige les résultats.
export async function cloturerVote(service, vote) {
  await service.from("votes_discord").update({ ferme: true }).eq("id", vote.id);
  const c = await decomptes(service, vote.id);
  await discord("PATCH", `/channels/${vote.channel_id}/messages/${vote.message_id}`, messageVote({ ...vote, ferme: true }, c)).catch(() => {});
}

const expire = (vote) => !vote.ferme && vote.fin_le && new Date(vote.fin_le).getTime() <= Date.now();

async function suivi(interaction, contenu) {
  await fetch(`${API()}/webhooks/${interaction.application_id}/${interaction.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...contenu, flags: 64 }),
  });
}

// Clic sur Pour / Contre : on répond tout de suite (type 6), puis on met le message à jour.
export function traiterVote(interaction) {
  const id = interaction.data?.custom_id;
  if (id !== ID_VOTE_POUR && id !== ID_VOTE_CONTRE) return null;
  const choix = id === ID_VOTE_POUR ? "pour" : "contre";
  const suite = async () => {
    try {
      const service = db();
      if (!service) return suivi(interaction, { content: "Les votes ne sont pas disponibles pour le moment." });
      const { data: vote } = await service.from("votes_discord").select("*").eq("message_id", interaction.message?.id).maybeSingle();
      if (!vote) return suivi(interaction, { content: "Ce vote est introuvable." });
      if (vote.ferme || expire(vote)) {
        if (!vote.ferme) await cloturerVote(service, vote);
        return suivi(interaction, { content: "Ce vote est terminé." });
      }
      const votant = interaction.member?.user?.id;
      if (!votant) return;

      if (vote.reserve) {
        const roleId = await idRoleCompteLie(interaction.guild_id);
        if (!roleId || !(interaction.member.roles || []).includes(roleId)) {
          return suivi(interaction, { content: "Ce vote est réservé aux comptes liés. Lie ton compte Gozly dans le salon sidentifier, puis réessaie." });
        }
      }

      const { data: ancien } = await service.from("votes_discord_bulletins").select("choix").eq("vote_id", vote.id).eq("discord_user_id", votant).maybeSingle();
      let retour;
      if (ancien?.choix === choix) {
        await service.from("votes_discord_bulletins").delete().eq("vote_id", vote.id).eq("discord_user_id", votant);
        retour = "Ton vote a été retiré.";
      } else {
        const { error } = await service
          .from("votes_discord_bulletins")
          .upsert({ vote_id: vote.id, discord_user_id: votant, choix, updated_at: new Date().toISOString() });
        if (error) throw new Error(error.message);
        retour = ancien ? `Ton vote a été changé pour **${choix === "pour" ? "Pour" : "Contre"}**.` : `Ton vote **${choix === "pour" ? "Pour" : "Contre"}** est enregistré. Merci!`;
      }

      const c = await decomptes(service, vote.id);
      await fetch(`${API()}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messageVote(vote, c)),
      });
      await suivi(interaction, { content: retour });
    } catch (e) {
      console.error("Erreur vote:", e.message);
      await suivi(interaction, { content: "Oups, ton vote n'a pas pu être enregistré. Réessaie dans un instant." }).catch(() => {});
    }
  };
  return { reponse: { type: 6 }, suite };
}

// Liste des votes pour le panneau admin (ferme au passage ceux dont la date est passée).
export async function listerVotes(service) {
  const { data, error } = await service.from("votes_discord").select("*").order("created_at", { ascending: false }).limit(30);
  if (error) throw new Error(error.message);
  const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
  const out = [];
  for (const v of data || []) {
    if (expire(v)) {
      await cloturerVote(service, v);
      v.ferme = true;
    }
    const c = await decomptes(service, v.id);
    out.push({
      id: v.id,
      titre: v.titre,
      description: v.description,
      reserve: v.reserve,
      ferme: v.ferme,
      finLe: v.fin_le,
      creeLe: v.created_at,
      pour: c.pour,
      contre: c.contre,
      url: `https://discord.com/channels/${guildId}/${v.channel_id}/${v.message_id}`,
    });
  }
  return out;
}
