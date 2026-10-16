// Enregistre (ou met à jour) les commandes slash du bot Discord de Gozly.
// À relancer chaque fois qu'on change la liste COMMANDES dans lib/discordBot.js :
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/discord-commandes.mjs
// (PowerShell : $env:DISCORD_APP_ID="..."; $env:DISCORD_BOT_TOKEN="..."; node scripts/discord-commandes.mjs)
import { readFileSync } from "fs";

const { DISCORD_APP_ID, DISCORD_BOT_TOKEN } = process.env;
if (!DISCORD_APP_ID || !DISCORD_BOT_TOKEN) {
  console.error("Il manque DISCORD_APP_ID ou DISCORD_BOT_TOKEN.");
  process.exit(1);
}

// On lit la liste directement dans le fichier pour ne pas dépendre de l'alias "@/".
const src = readFileSync(new URL("../lib/discordBot.js", import.meta.url), "utf8");
const debut = src.indexOf("export const COMMANDES = ");
const commandes = new Function(`return ${src.slice(debut + "export const COMMANDES = ".length).trim().replace(/;$/, "")}`)();

const res = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(commandes),
});
const texte = await res.text();
if (!res.ok) {
  console.error("Échec", res.status, texte);
  process.exit(1);
}
console.log(`${JSON.parse(texte).length} commandes enregistrées.`);
