import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { signatureValide, traiterInteraction } from "@/lib/discordBot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Point d'entrée des interactions Discord (commandes slash). Discord signe chaque requête
// (Ed25519) : sans signature valide on répond 401, ce qui est aussi exigé pour enregistrer l'URL.
export async function POST(request) {
  const corps = await request.text();
  const ok = signatureValide(
    corps,
    request.headers.get("x-signature-ed25519"),
    request.headers.get("x-signature-timestamp"),
    process.env.DISCORD_PUBLIC_KEY
  );
  if (!ok) return new NextResponse("Signature invalide", { status: 401 });

  let interaction;
  try {
    interaction = JSON.parse(corps);
  } catch {
    return new NextResponse("Requête invalide", { status: 400 });
  }
  const { reponse, suite } = await traiterInteraction(interaction);
  if (suite) waitUntil(suite().catch(() => {}));
  return NextResponse.json(reponse);
}
