import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminServer";
import { COMMANDES } from "@/lib/discordBot";

export const dynamic = "force-dynamic";

// Enregistre (ou met à jour) les commandes slash du bot auprès de Discord, depuis le panneau admin :
// plus besoin de copier le token dans un terminal. L'identifiant de l'application est déduit du token
// (la première partie d'un token de bot est l'identifiant du bot en base64, égal à celui de l'application).
export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const token = (process.env.DISCORD_BOT_TOKEN || "").trim();
  if (!token) return NextResponse.json({ error: "DISCORD_BOT_TOKEN est absent dans Vercel." }, { status: 500 });

  const appId = process.env.DISCORD_APP_ID?.trim() || Buffer.from(token.split(".")[0], "base64").toString("utf8");
  if (!/^\d+$/.test(appId)) return NextResponse.json({ error: "Impossible de déduire l'identifiant de l'application (token invalide?)." }, { status: 500 });

  const base = process.env.DISCORD_API_BASE || "https://discord.com/api/v10";
  const res = await fetch(`${base}/applications/${appId}/commands`, {
    method: "PUT",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(COMMANDES),
    cache: "no-store",
  });
  const texte = await res.text();
  if (!res.ok) return NextResponse.json({ error: `Discord ${res.status} : ${texte.slice(0, 200).replace(token, "***")}` }, { status: 502 });
  const liste = JSON.parse(texte);
  return NextResponse.json({ ok: true, commandes: liste.map((c) => c.name) });
}
