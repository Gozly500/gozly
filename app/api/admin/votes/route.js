import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminServer";
import { cloturerVote, creerVote, db, listerVotes } from "@/lib/discordVotes";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET  : liste des votes (avec résultats en direct).
// POST { titre, description, dureeHeures, reserve } : publie un nouveau vote dans Discord.
// POST { action: "cloturer", id } : termine un vote.
export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = db();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  try {
    return NextResponse.json({ votes: await listerVotes(service) });
  } catch (e) {
    const manque = /votes_discord/.test(e.message);
    return NextResponse.json({ error: manque ? "La base n'est pas prête (SQL votes_discord.sql à exécuter)." : e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { errorStatus, errorMessage, user } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = db();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });

  const corps = await request.json().catch(() => ({}));
  try {
    if (corps.action === "cloturer") {
      const { data: vote } = await service.from("votes_discord").select("*").eq("id", corps.id).maybeSingle();
      if (!vote) return NextResponse.json({ error: "Vote introuvable." }, { status: 404 });
      await cloturerVote(service, vote);
      return NextResponse.json({ ok: true });
    }

    const titre = String(corps.titre || "").trim().slice(0, 200);
    const description = String(corps.description || "").trim().slice(0, 1500);
    if (!titre) return NextResponse.json({ error: "Le sujet du vote est obligatoire." }, { status: 400 });
    const duree = [0, 24, 72, 168].includes(Number(corps.dureeHeures)) ? Number(corps.dureeHeures) : 0;
    const vote = await creerVote(service, { titre, description, dureeHeures: duree, reserve: !!corps.reserve, creePar: user?.email });
    return NextResponse.json({ ok: true, url: vote.url });
  } catch (e) {
    return NextResponse.json({ error: String(e.message).replace(process.env.DISCORD_BOT_TOKEN || "\0", "***").slice(0, 300) }, { status: 502 });
  }
}
