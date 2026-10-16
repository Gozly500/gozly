import { NextResponse } from "next/server";
import { verifierEtAnnoncer } from "@/lib/statutDiscord";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Alertes de statut dans Discord : appelé toutes les 5 minutes par la planification Supabase (pg_cron, voir
// supabase/statut_discord.sql), comme les rappels. Annonce dans le salon des statuts quand l'état d'un système change.
export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  // Sans CRON_SECRET configuré, refuser tout : sinon "Bearer undefined" passerait.
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await verifierEtAnnoncer()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message).replace(process.env.DISCORD_BOT_TOKEN || "\0", "***").slice(0, 300) }, { status: 500 });
  }
}
