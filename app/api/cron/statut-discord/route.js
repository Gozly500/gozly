import { NextResponse } from "next/server";
import { verifierEtAnnoncer } from "@/lib/statutDiscord";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Alertes de statut dans Discord : appelé toutes les 5 minutes par la planification Supabase (pg_cron, voir
// supabase/statut_discord.sql), comme les rappels. Annonce dans le salon des statuts quand l'état d'un système change.
export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  // Deux clés possibles : STATUT_CRON_SECRET (clé propre aux alertes de statut) ou CRON_SECRET (celle des autres
  // tâches). Une variable absente ne doit jamais autoriser : sinon "Bearer undefined" passerait.
  const cles = [process.env.STATUT_CRON_SECRET, process.env.CRON_SECRET].filter((c) => c && c.length >= 16);
  if (!cles.some((c) => authHeader === `Bearer ${c}`)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await verifierEtAnnoncer()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message).replace(process.env.DISCORD_BOT_TOKEN || "\0", "***").slice(0, 300) }, { status: 500 });
  }
}
