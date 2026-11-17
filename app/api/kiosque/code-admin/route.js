import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

// Code administrateur de Gozly pour le kiosque Windows : il ouvre les paramètres de Windows, que les clients n'ont pas. Le code vit dans la
// variable d'environnement KIOSQUE_CODE_ADMIN (Vercel) : il n'est jamais dans l'app ni dans le site. L'app Windows demande la vérification ici
// avant d'ouvrir quoi que ce soit.
// Freins aux essais au hasard : 5 mauvais codes par adresse IP en 10 minutes, puis refus (en mémoire du serveur, donc au mieux), et chaque
// mauvais code attend une seconde avant de répondre.
const MAX_ECHECS = 5;
const FENETRE_MS = 10 * 60 * 1000;
const echecs = new Map(); // ip -> [instants des mauvais codes]

const empreinte = (texte) => createHash("sha256").update(String(texte)).digest();

function ipDe(request) {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnue";
}

export async function POST(request) {
  const secret = process.env.KIOSQUE_CODE_ADMIN;
  if (!secret) return NextResponse.json({ ok: false, error: "Code administrateur non configuré." }, { status: 503 });

  const ip = ipDe(request);
  const maintenant = Date.now();
  const recents = (echecs.get(ip) || []).filter((t) => maintenant - t < FENETRE_MS);
  if (recents.length >= MAX_ECHECS) return NextResponse.json({ ok: false, error: "Trop d'essais." }, { status: 429 });

  const { code } = await request.json().catch(() => ({}));
  const bon = typeof code === "string" && code.length > 0 && code.length <= 100 && timingSafeEqual(empreinte(code), empreinte(secret));
  if (!bon) {
    echecs.set(ip, [...recents, maintenant]);
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ ok: false, error: "Code incorrect." }, { status: 401 });
  }
  echecs.delete(ip);
  return NextResponse.json({ ok: true });
}
