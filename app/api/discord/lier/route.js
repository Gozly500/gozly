import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { changerRole, enregistrerLiaison, lireJeton } from "@/lib/discordLiaison";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function utilisateur(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
  } = await getSupabaseForToken(token).auth.getUser(token);
  return user || null;
}

// GET ?t=<jeton> : le lien est-il valide ? (public, renvoie seulement le nom Discord de la personne)
// GET (connecté)  : ce compte est-il déjà lié à Discord ?
export async function GET(request) {
  const t = new URL(request.url).searchParams.get("t");
  if (t) {
    const jeton = lireJeton(t);
    return NextResponse.json(jeton ? { valide: true, nom: jeton.nom } : { valide: false });
  }
  const user = await utilisateur(request);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  const { data, error } = await service.from("profils").select("discord_id").eq("id", user.id).maybeSingle();
  if (error) return NextResponse.json({ lie: false, sqlManquant: true });
  return NextResponse.json({ lie: !!data?.discord_id });
}

// POST { t } : confirme la liaison.   POST { action: "delier" } : retire la liaison.
export async function POST(request) {
  const user = await utilisateur(request);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });

  const corps = await request.json().catch(() => ({}));
  try {
    if (corps.action === "delier") {
      const { data } = await service.from("profils").select("discord_id").eq("id", user.id).maybeSingle();
      const ancien = data?.discord_id;
      const { error } = await enregistrerLiaison(service, user.id, null);
      if (error) throw new Error(error.message);
      const role = ancien ? await changerRole(ancien, false).catch(() => "erreur") : "ok";
      return NextResponse.json({ ok: true, role });
    }

    const jeton = lireJeton(corps.t);
    if (!jeton) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 400 });
    const { error } = await enregistrerLiaison(service, user.id, jeton.discordId);
    if (error) {
      const manque = /discord_id/.test(error.message);
      return NextResponse.json({ error: manque ? "La base n'est pas prête (SQL profil_discord.sql à exécuter)." : error.message }, { status: 500 });
    }
    const role = await changerRole(jeton.discordId, true).catch(() => "erreur");
    return NextResponse.json({ ok: true, role });
  } catch (e) {
    return NextResponse.json({ error: String(e.message).slice(0, 200) }, { status: 502 });
  }
}
