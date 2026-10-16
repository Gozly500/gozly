import { calculerStatut } from "@/lib/statutServer";
import { discord } from "@/lib/discordTickets";
import { db } from "@/lib/discordVotes";

// Alertes de statut dans Discord : quand l'état d'un système change (Fonctionne / Problème / Non fonctionnel),
// Gozyx l'annonce dans le salon des statuts.
//  - Appelé toutes les 5 minutes (pg_cron, voir supabase/statut_discord.sql) et tout de suite quand un admin
//    change un état à la main sur /statut.
//  - Pour éviter les fausses alertes, un changement DÉTECTÉ automatiquement doit être vu 2 fois de suite
//    (donc ~5 à 10 min) avant d'être annoncé ; un changement MANUEL d'un admin est annoncé tout de suite.
//  - Le premier passage ne fait qu'enregistrer l'état actuel (aucune annonce).

const SITE = "https://gozly.net";
const EMOJI = { ok: "🟢", probleme: "🟡", panne: "🔴" };
const LIBELLE = { ok: "Fonctionne", probleme: "Problème", panne: "Non fonctionnel" };
const COULEUR = { ok: 0x3c8000, probleme: 0xf5b800, panne: 0xe5232e };
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Salon des statuts : variable DISCORD_CHANNEL_STATUT, sinon le premier salon dont le nom contient « statut ».
async function salonStatut(guildId) {
  const force = (process.env.DISCORD_CHANNEL_STATUT || "").trim();
  if (/^\d+$/.test(force)) return force;
  const salons = await discord("GET", `/guilds/${guildId}/channels`);
  return salons.find((c) => (c.type === 0 || c.type === 5) && norm(c.name).includes("statut"))?.id || null;
}

function messageAlerte(changements, global) {
  const degrades = changements.filter((c) => c.etat !== "ok");
  const retablis = changements.filter((c) => c.etat === "ok");
  const lignes = [
    ...degrades.map((c) => `${EMOJI[c.etat]} **${c.nom}** : ${LIBELLE[c.etat]}${c.message ? `\n> ${c.message}` : ""}`),
    ...retablis.map((c) => `${EMOJI.ok} **${c.nom}** fonctionne de nouveau`),
  ];
  let titre;
  if (global === "ok") titre = "✅ Tout fonctionne";
  else if (global === "panne") titre = "🔴 Un ou des systèmes sont non fonctionnels";
  else titre = "🟡 Un ou des systèmes ont un problème";
  return {
    embeds: [
      {
        title: titre,
        description: lignes.join("\n\n"),
        color: COULEUR[global],
        footer: { text: "Statut complet : gozly.net/statut" },
        timestamp: new Date().toISOString(),
      },
    ],
    allowed_mentions: { parse: [] },
  };
}

// Retourne { annonces, baseline, erreur? } (utile au dépannage et aux tests).
export async function verifierEtAnnoncer() {
  const service = db();
  const guildId = (process.env.DISCORD_GUILD_ID || "").trim();
  if (!service || !guildId || !process.env.DISCORD_BOT_TOKEN) return { annonces: 0, baseline: 0, erreur: "Configuration manquante." };

  const statut = await calculerStatut(SITE);
  const systemes = statut.groupes.flatMap((g) => g.systemes);
  const { data: lignes, error } = await service.from("statut_discord_etat").select("*");
  if (error) return { annonces: 0, baseline: 0, erreur: /statut_discord_etat/.test(error.message) ? "SQL statut_discord.sql pas exécuté." : error.message };
  const precedent = new Map((lignes || []).map((l) => [l.cle, l]));

  const changements = [];
  let baseline = 0;
  for (const s of systemes) {
    const prev = precedent.get(s.cle);
    if (!prev) {
      await service.from("statut_discord_etat").upsert({ cle: s.cle, etat: s.etat, candidat: null, candidat_n: 0, maj: new Date().toISOString() });
      baseline++;
      continue;
    }
    if (prev.etat === s.etat) {
      if (prev.candidat) await service.from("statut_discord_etat").update({ candidat: null, candidat_n: 0 }).eq("cle", s.cle);
      continue;
    }
    // L'état a changé : immédiat si manuel, sinon il faut le voir 2 fois de suite.
    const n = prev.candidat === s.etat ? (prev.candidat_n || 0) + 1 : 1;
    if (s.manuel || n >= 2) {
      changements.push({ cle: s.cle, nom: s.nom, etat: s.etat, message: s.message || "" });
    } else {
      await service.from("statut_discord_etat").update({ candidat: s.etat, candidat_n: n }).eq("cle", s.cle);
    }
  }

  if (changements.length === 0) return { annonces: 0, baseline };

  const canal = await salonStatut(guildId);
  if (!canal) return { annonces: 0, baseline, erreur: "Salon des statuts introuvable (un salon dont le nom contient « statut »)." };

  // On enregistre le nouvel état APRÈS l'envoi : si Discord refuse, on réessaiera au prochain passage.
  await discord("POST", `/channels/${canal}/messages`, messageAlerte(changements, statut.global));
  for (const c of changements) {
    await service.from("statut_discord_etat").upsert({ cle: c.cle, etat: c.etat, candidat: null, candidat_n: 0, maj: new Date().toISOString() });
  }
  return { annonces: changements.length, baseline };
}
