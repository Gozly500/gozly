// Système de tickets Gozlyx (Discord). Tout passe par des boutons (interactions HTTP) et l'API REST
// avec le token du bot : aucun bot connecté en continu requis.
//
// Fonctionnement :
// - /ticket-panneau (admin) poste un message avec le bouton "Ouvrir un ticket".
// - Le bouton crée un salon privé (visible par la personne, les Admin et les Modérateurs).
//   Le salon est reconnu grâce à son sujet : "ticket:<id de la personne>".
// - "Fermer" rend le salon en lecture seule et le renomme "ferme-...". Il n'est JAMAIS supprimé
//   par le bot : c'est un admin qui le supprime à la main. "Rouvrir" le remet en état.

const API = () => process.env.DISCORD_API_BASE || "https://discord.com/api/v10";

// Bits de permissions Discord.
const VOIR = 1 << 10;
const ECRIRE = 1 << 11;
const LIENS = 1 << 14;
const FICHIERS = 1 << 15;
const HISTORIQUE = 1 << 16;
const GERER_SALONS = 1 << 4;
const ADMIN = 8;
const PERMS_ACTIVES = VOIR | ECRIRE | LIENS | FICHIERS | HISTORIQUE;

const ROLES_EQUIPE = [/^admin/, /^moderat/, /^modo/];

export const ID_OUVRIR = "ticket_ouvrir";
export const ID_FERMER = "ticket_fermer";
export const ID_ROUVRIR = "ticket_rouvrir";

async function discord(methode, chemin, corps) {
  const res = await fetch(API() + chemin, {
    method: methode,
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await res.text();
  if (!res.ok) throw new Error(`Discord ${methode} ${chemin} -> ${res.status} ${texte.slice(0, 200)}`);
  return texte ? JSON.parse(texte) : null;
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function nomSalon(prefixe, utilisateur) {
  const base = norm(utilisateur.global_name || utilisateur.username)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  return `${prefixe}-${base || "membre"}`;
}

async function rolesEquipe(guildId) {
  const roles = await discord("GET", `/guilds/${guildId}/roles`);
  return roles.filter((r) => ROLES_EQUIPE.some((re) => re.test(norm(r.name)))).map((r) => r.id);
}

function estEquipe(interaction, idsRolesEquipe) {
  const m = interaction.member;
  if (!m) return false;
  if (m.permissions && (BigInt(m.permissions) & BigInt(ADMIN)) !== 0n) return true;
  return (m.roles || []).some((r) => idsRolesEquipe.includes(r));
}

const BOUTON = (label, id, style) => ({ type: 1, components: [{ type: 2, style, label, custom_id: id }] });

// Message du panneau (commande /ticket-panneau).
export function panneauTickets() {
  return {
    embeds: [
      {
        title: "🎫 Besoin d'aide?",
        description:
          "Clique sur le bouton pour ouvrir un ticket. Un salon privé sera créé, visible seulement par toi et l'équipe Gozly.\n\nPour une question rapide, essaie d'abord la commande `/aide`.",
        color: 0x2a38ea,
        footer: { text: "Gozlyx • Support Gozly" },
      },
    ],
    components: [BOUTON("Ouvrir un ticket", ID_OUVRIR, 1)],
  };
}

async function patchOriginal(interaction, contenu) {
  await fetch(`${API()}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contenu),
  });
}

// Message visible seulement par la personne qui a cliqué (refus, erreur) sans toucher au message du bouton.
async function refus(interaction, texte) {
  await fetch(`${API()}/webhooks/${interaction.application_id}/${interaction.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: texte, flags: 64 }),
  });
}

async function ouvrir(interaction) {
  const guildId = interaction.guild_id;
  const utilisateur = interaction.member.user;
  const salons = await discord("GET", `/guilds/${guildId}/channels`);
  const existant = salons.find((c) => c.type === 0 && c.topic === `ticket:${utilisateur.id}` && !c.name.startsWith("ferme-"));
  if (existant) return patchOriginal(interaction, { content: `Tu as déjà un ticket ouvert : <#${existant.id}>` });

  const equipe = await rolesEquipe(guildId);
  const permissions = [
    { id: guildId, type: 0, deny: String(VOIR) },
    { id: utilisateur.id, type: 1, allow: String(PERMS_ACTIVES) },
    { id: interaction.application_id, type: 1, allow: String(PERMS_ACTIVES | GERER_SALONS) },
    ...equipe.map((id) => ({ id, type: 0, allow: String(PERMS_ACTIVES) })),
  ];
  const salon = await discord("POST", `/guilds/${guildId}/channels`, {
    name: nomSalon("ticket", utilisateur),
    type: 0,
    topic: `ticket:${utilisateur.id}`,
    parent_id: interaction.channel?.parent_id || undefined,
    permission_overwrites: permissions,
  });
  const mentionsEquipe = equipe.map((id) => `<@&${id}>`).join(" ");
  await discord("POST", `/channels/${salon.id}/messages`, {
    content: `<@${utilisateur.id}> ${mentionsEquipe}`.trim(),
    allowed_mentions: { users: [utilisateur.id], roles: equipe },
    embeds: [
      {
        title: "Bienvenue dans ton ticket",
        description:
          "Décris ton problème ou ta question le plus clairement possible (et ajoute une capture d'écran si ça aide). Quelqu'un de l'équipe va te répondre dès que possible.\n\nQuand c'est réglé, clique sur **Fermer le ticket**.",
        color: 0x2a38ea,
      },
    ],
    components: [BOUTON("Fermer le ticket", ID_FERMER, 4)],
  });
  return patchOriginal(interaction, { content: `Ton ticket est prêt : <#${salon.id}>` });
}

async function proprietaireTicket(canalId) {
  const canal = await discord("GET", `/channels/${canalId}`);
  const m = /^ticket:(\d+)$/.exec(canal.topic || "");
  return { canal, proprietaire: m ? m[1] : null };
}

async function fermer(interaction) {
  const { canal, proprietaire } = await proprietaireTicket(interaction.channel_id);
  if (!proprietaire) return refus(interaction, "Ce salon n'est pas un ticket.");
  const equipe = await rolesEquipe(interaction.guild_id);
  const auteur = interaction.member.user.id;
  if (auteur !== proprietaire && !estEquipe(interaction, equipe)) {
    return refus(interaction, "Seule la personne qui a ouvert le ticket ou l'équipe peut le fermer.");
  }
  if (canal.name.startsWith("ferme-")) return refus(interaction, "Ce ticket est déjà fermé.");

  await discord("PUT", `/channels/${canal.id}/permissions/${proprietaire}`, {
    type: 1,
    allow: String(VOIR | HISTORIQUE),
    deny: String(ECRIRE | LIENS | FICHIERS),
  });
  await discord("PATCH", `/channels/${canal.id}`, { name: canal.name.replace(/^ticket-/, "ferme-") });
  return patchOriginal(interaction, {
    content: "",
    embeds: [
      {
        title: "🔒 Ticket fermé",
        description: `Fermé par <@${auteur}>. Le salon reste en lecture seule : un admin le supprimera quand ce sera le moment.`,
        color: 0x6b7280,
      },
    ],
    components: [BOUTON("Rouvrir le ticket", ID_ROUVRIR, 2)],
  });
}

async function rouvrir(interaction) {
  const { canal, proprietaire } = await proprietaireTicket(interaction.channel_id);
  if (!proprietaire) return refus(interaction, "Ce salon n'est pas un ticket.");
  const equipe = await rolesEquipe(interaction.guild_id);
  if (interaction.member.user.id !== proprietaire && !estEquipe(interaction, equipe)) {
    return refus(interaction, "Seule la personne qui a ouvert le ticket ou l'équipe peut le rouvrir.");
  }
  await discord("PUT", `/channels/${canal.id}/permissions/${proprietaire}`, { type: 1, allow: String(PERMS_ACTIVES), deny: "0" });
  await discord("PATCH", `/channels/${canal.id}`, { name: canal.name.replace(/^ferme-/, "ticket-") });
  return patchOriginal(interaction, {
    content: "",
    embeds: [{ title: "🔓 Ticket rouvert", description: `Rouvert par <@${interaction.member.user.id}>.`, color: 0x3c8000 }],
    components: [BOUTON("Fermer le ticket", ID_FERMER, 4)],
  });
}

// Clic sur un bouton : réponse différée (le travail dépasse parfois 3 s), puis suivi.
// Pour "ouvrir" la réponse est éphémère (seule la personne la voit) ; pour fermer/rouvrir on
// met à jour le message du bouton.
export function traiterBouton(interaction) {
  const id = interaction.data?.custom_id;
  const action = { [ID_OUVRIR]: ouvrir, [ID_FERMER]: fermer, [ID_ROUVRIR]: rouvrir }[id];
  if (!action) return null;
  const reponse = id === ID_OUVRIR ? { type: 5, data: { flags: 64 } } : { type: 6 };
  const suite = async () => {
    try {
      await action(interaction);
    } catch (e) {
      console.error("Erreur ticket:", e.message);
      // Détail visible seulement par la personne qui a cliqué (message éphémère), sans le token.
      const detail = String(e.message).replace(process.env.DISCORD_BOT_TOKEN || "\0", "***").slice(0, 300);
      const msg = `Oups, quelque chose n'a pas fonctionné. Réessaie ou écris-nous à gozly.pro@gmail.com.\n\nDétail technique : ${detail}`;
      if (id === ID_OUVRIR) await patchOriginal(interaction, { content: msg }).catch(() => {});
      else await refus(interaction, msg).catch(() => {});
    }
  };
  return { reponse, suite };
}
