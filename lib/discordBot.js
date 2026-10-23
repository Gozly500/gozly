import crypto from "crypto";
import { panneauTickets, traiterBouton } from "@/lib/discordTickets";
import { creerJeton } from "@/lib/discordLiaison";
import { traiterVote, creerVote, db } from "@/lib/discordVotes";
import { estEquipe, rolesEquipe } from "@/lib/discordTickets";

// Bot Discord de Gozly : mode "interactions" (Discord envoie les commandes slash en HTTP à
// /api/discord, aucun serveur à garder allumé). Réponse exigée en moins de 3 secondes.

const PREFIXE_ED25519_SPKI = Buffer.from("302a300506032b6570032100", "hex");

export function signatureValide(corps, signature, horodatage, cleHex) {
  try {
    if (!signature || !horodatage || !cleHex) return false;
    const cle = crypto.createPublicKey({
      key: Buffer.concat([PREFIXE_ED25519_SPKI, Buffer.from(cleHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return crypto.verify(null, Buffer.from(horodatage + corps), cle, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

const COULEURS = { ok: 0x3c8000, probleme: 0xf5b800, panne: 0xe5232e };
const TEXTES = {
  fr: {
    etat: { ok: "Fonctionne", probleme: "Problème", panne: "Non fonctionnel" },
    emoji: { ok: "🟢", probleme: "🟡", panne: "🔴" },
    titreStatut: { ok: "Tous les systèmes fonctionnent", probleme: "Un ou des systèmes ont un problème", panne: "Un ou des systèmes sont non fonctionnels" },
    lent: "La vérification prend trop de temps, réessaie dans un instant.",
    voirStatut: "Page de statut complète",
    aucune: "Je n'ai rien trouvé là-dessus. Essaie d'autres mots, ou écris-nous à info@gozly.net.",
    aideTitre: "Centre d'aide",
    plus: "Plus de réponses",
    liensTitre: "Liens Gozly",
    liens: ["Site", "Centre d'aide", "Statut", "Scattegories"],
  },
  en: {
    etat: { ok: "Operational", probleme: "Issue", panne: "Not working" },
    emoji: { ok: "🟢", probleme: "🟡", panne: "🔴" },
    titreStatut: { ok: "All systems operational", probleme: "One or more systems have an issue", panne: "One or more systems are not working" },
    lent: "The check is taking too long, try again in a moment.",
    voirStatut: "Full status page",
    aucune: "I couldn't find anything on that. Try other words, or write to us at info@gozly.net.",
    aideTitre: "Help center",
    plus: "More answers",
    liensTitre: "Gozly links",
    liens: ["Website", "Help center", "Status", "Scattegories"],
  },
};

const SITE = "https://gozly.net";

function norm(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function reponse(embeds) {
  return { type: 4, data: { embeds } };
}

// /statut peut prendre plus de 3 s (vérifications réseau) : on répond tout de suite "réflexion en cours"
// (type 5) puis on remplace le message par le résultat via le webhook de l'interaction.
async function messageStatut(langue) {
  const T = TEXTES[langue];
  const { calculerStatut } = await import("@/lib/statutServer");
  const statut = await calculerStatut(SITE).catch(() => null);
  if (!statut) return { content: T.lent };
  const champs = statut.groupes.map((g) => ({
    name: g.titre,
    value: g.systemes.map((s) => `${T.emoji[s.etat]} ${s.nom}${s.etat === "ok" ? "" : ` - ${T.etat[s.etat]}`}`).join("\n"),
    inline: true,
  }));
  return {
    embeds: [
      {
        title: T.titreStatut[statut.global],
        url: `${SITE}/statut`,
        color: COULEURS[statut.global],
        fields: champs,
        footer: { text: T.voirStatut + " : gozly.net/statut" },
        timestamp: statut.verifieA,
      },
    ],
  };
}

async function suiviStatut(interaction, langue) {
  const message = await messageStatut(langue);
  await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
}

async function commandeAide(requete, langue) {
  const T = TEXTES[langue];
  const { AIDE } = await import("@/lib/aide");
  const categories = AIDE[langue];
  const mots = norm(requete || "").split(/\s+/).filter(Boolean);
  if (!mots.length) {
    return reponse([
      {
        title: T.aideTitre,
        url: `${SITE}/aide`,
        color: 0x2a38ea,
        description: categories.map((c) => `• **${c.titre}**`).join("\n"),
        footer: { text: "gozly.net/aide" },
      },
    ]);
  }
  const trouvees = [];
  for (const c of categories) {
    for (const q of c.questions) {
      const texte = norm(q.q + " " + q.r.join(" "));
      const score = mots.filter((m) => texte.includes(m)).length;
      if (score === mots.length) trouvees.push({ q, score: norm(q.q).includes(mots[0]) ? 2 : 1 });
    }
  }
  if (!trouvees.length) return { type: 4, data: { content: T.aucune } };
  trouvees.sort((a, b) => b.score - a.score);
  const [premiere, ...autres] = trouvees;
  const description = premiere.q.r.join("\n\n").slice(0, 1800);
  const embed = {
    title: premiere.q.q.slice(0, 250),
    url: `${SITE}/aide`,
    color: 0x2a38ea,
    description,
  };
  if (autres.length) {
    embed.fields = [{ name: T.plus, value: autres.slice(0, 4).map((a) => `• ${a.q.q}`).join("\n").slice(0, 1000) }];
  }
  return reponse([embed]);
}

function commandeLiens(langue) {
  const T = TEXTES[langue];
  const urls = [SITE, `${SITE}/aide`, `${SITE}/statut`, `${SITE}/scattegories`];
  return reponse([
    {
      title: T.liensTitre,
      color: 0x2a38ea,
      description: urls.map((u, i) => `**${T.liens[i]}** : ${u}`).join("\n"),
    },
  ]);
}

// /referendum : réservé à l'équipe (admins et modérateurs). Réponse différée visible seulement par la personne.
async function suiviReferendum(interaction) {
  const base = process.env.DISCORD_API_BASE || "https://discord.com/api/v10";
  const repondre = (content) =>
    fetch(`${base}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  try {
    const equipe = await rolesEquipe(interaction.guild_id);
    if (!estEquipe(interaction, equipe)) return repondre("Cette commande est réservée aux admins et aux modérateurs.");
    const opt = (nom) => (interaction.data?.options || []).find((o) => o.name === nom)?.value;
    const titre = String(opt("sujet") || "").trim().slice(0, 200);
    if (!titre) return repondre("Écris le sujet du vote.");
    const service = db();
    if (!service) return repondre("Les votes ne sont pas disponibles pour le moment.");
    const u = interaction.member.user;
    const vote = await creerVote(service, {
      titre,
      description: String(opt("description") || "").trim().slice(0, 1500),
      dureeHeures: [0, 24, 72, 168].includes(Number(opt("duree"))) ? Number(opt("duree")) : 0,
      reserve: opt("reserve") === true,
      creePar: `discord:${u.global_name || u.username}`,
    });
    return repondre(`✅ Vote publié : ${vote.url}`);
  } catch (e) {
    console.error("Erreur /referendum:", e.message);
    return repondre(`Oups, le vote n'a pas pu être publié. ${String(e.message).replace(process.env.DISCORD_BOT_TOKEN || "\0", "***").slice(0, 200)}`);
  }
}

// Liaison du compte Gozly (salon "sidentifier").
const ID_LIER = "liaison_lier";

function panneauLiaison() {
  return {
    embeds: [
      {
        title: "🔗 Lie ton compte Gozly",
        description:
          "Tu as un compte Gozly? Clique sur le bouton pour le lier à ton Discord. Tu recevras le rôle **Compte lié**, qui débloque les salons réservés aux utilisateurs de Gozly.\n\nOn ne garde que ton identifiant Discord. Tu peux délier ton compte à tout moment.",
        color: 0x2a38ea,
        footer: { text: "Gozyx • Compte Gozly" },
      },
    ],
    components: [{ type: 1, components: [{ type: 2, style: 1, label: "Lier mon compte Gozly", custom_id: ID_LIER }] }],
  };
}

// Clic sur "Lier mon compte" : réponse immédiate, visible seulement par la personne, avec son lien signé.
function reponseLiaison(interaction) {
  const user = interaction.member?.user || interaction.user;
  if (!user || !process.env.DISCORD_BOT_TOKEN) return { type: 4, data: { content: "La liaison n'est pas disponible pour le moment.", flags: 64 } };
  const lien = `${SITE}/discord/lier?t=${creerJeton(user.id, user.global_name || user.username)}`;
  return {
    type: 4,
    data: {
      flags: 64,
      content: "Voici ton lien personnel (valide 15 minutes). Ouvre-le, connecte-toi à Gozly et confirme.",
      components: [{ type: 1, components: [{ type: 2, style: 5, label: "Continuer sur Gozly", url: lien }] }],
    },
  };
}

// interaction = corps JSON déjà validé (signature OK). Retourne { reponse, suite? } :
// "suite" est un travail à finir après avoir répondu (réponse différée).
export async function traiterInteraction(interaction) {
  if (interaction.type === 1) return { reponse: { type: 1 } }; // PING
  if (interaction.type === 3) {
    if (interaction.data?.custom_id === ID_LIER) return { reponse: reponseLiaison(interaction) };
    const vote = traiterVote(interaction); // clic Pour / Contre sur un référendum
    if (vote) return vote;
    const bouton = traiterBouton(interaction); // clic sur un bouton (tickets)
    if (bouton) return bouton;
  }
  if (interaction.type === 2) {
    const langue = String(interaction.locale || "").startsWith("en") ? "en" : "fr";
    const nom = interaction.data?.name;
    const option = (interaction.data?.options || []).find((o) => o.name === "sujet")?.value;
    if (nom === "statut") return { reponse: { type: 5 }, suite: () => suiviStatut(interaction, langue) };
    if (nom === "aide") return { reponse: await commandeAide(option, langue) };
    if (nom === "liens") return { reponse: commandeLiens(langue) };
    if (nom === "sidentifier-panneau") return { reponse: { type: 4, data: panneauLiaison() } };
    if (nom === "referendum") return { reponse: { type: 5, data: { flags: 64 } }, suite: () => suiviReferendum(interaction) };
    if (nom === "ticket-panneau") return { reponse: { type: 4, data: panneauTickets() } };
  }
  return { reponse: { type: 4, data: { content: "🤷", flags: 64 } } };
}

export const COMMANDES = [
  { name: "statut", description: "Voir l'état de tous les systèmes Gozly", description_localizations: { "en-US": "See the status of all Gozly systems", "en-GB": "See the status of all Gozly systems" } },
  {
    name: "aide",
    description: "Chercher une réponse dans le centre d'aide",
    description_localizations: { "en-US": "Search the help center", "en-GB": "Search the help center" },
    options: [
      {
        type: 3,
        name: "sujet",
        description: "Ta question ou quelques mots (ex: mot de passe, pointage)",
        description_localizations: { "en-US": "Your question or a few words (e.g. password, time clock)", "en-GB": "Your question or a few words (e.g. password, time clock)" },
        required: false,
      },
    ],
  },
  {
    // Visible seulement par ceux qui ont la permission « Gérer les messages » (admins et modérateurs) ; le code
    // revérifie le rôle (Admin / Modérateur) à chaque utilisation. Le propriétaire du serveur peut ajuster
    // qui voit la commande dans Paramètres du serveur > Intégrations > Gozyx.
    name: "referendum",
    name_localizations: { fr: "référendum" },
    description: "Publier un vote Pour / Contre dans le salon des référendums (admin et modo)",
    default_member_permissions: "8192",
    dm_permission: false,
    options: [
      { type: 3, name: "sujet", description: "La question du vote", required: true, max_length: 200 },
      { type: 3, name: "description", description: "Explications (facultatif)", required: false, max_length: 1500 },
      {
        type: 4,
        name: "duree",
        description: "Durée du vote (par défaut : sans limite)",
        required: false,
        choices: [
          { name: "Sans limite", value: 0 },
          { name: "24 heures", value: 24 },
          { name: "3 jours", value: 72 },
          { name: "7 jours", value: 168 },
        ],
      },
      { type: 5, name: "reserve", description: "Réservé aux membres avec le rôle Compte lié", required: false },
    ],
  },
  {
    name: "sidentifier-panneau",
    description: "Poster le message pour lier son compte Gozly (admin)",
    default_member_permissions: "8",
    dm_permission: false,
  },
  {
    name: "ticket-panneau",
    description: "Poster le message avec le bouton pour ouvrir un ticket (admin)",
    default_member_permissions: "8",
    dm_permission: false,
  },
  { name: "liens", description: "Les liens utiles de Gozly", description_localizations: { "en-US": "Useful Gozly links", "en-GB": "Useful Gozly links" } },
];
