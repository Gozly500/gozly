import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { signatureValide, traiterInteraction } from "@/lib/discordBot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Point d'entrée des interactions Discord (commandes slash). Discord signe chaque requête
// (Ed25519) : sans signature valide on répond 401, ce qui est aussi exigé pour enregistrer l'URL.
// Variable collée parfois avec des espaces, des guillemets ou un retour à la ligne : on nettoie.
function cleePublique() {
  return (process.env.DISCORD_PUBLIC_KEY || "").trim().replace(/^["']|["']$/g, "").trim();
}

export async function POST(request) {
  const corps = await request.text();
  const ok = signatureValide(
    corps,
    request.headers.get("x-signature-ed25519"),
    request.headers.get("x-signature-timestamp"),
    cleePublique()
  );
  if (!ok) {
    // Diagnostic sans rien révéler de la clé : absente, mauvaise longueur, ou simplement signature fausse.
    const cle = cleePublique();
    const etat = !cle ? "cle-absente" : !/^[0-9a-f]{64}$/i.test(cle) ? `cle-format-invalide, ${cle.length} caracteres au lieu de 64` : "signature-fausse";
    return new NextResponse(`Signature invalide (${etat})`, { status: 401 });
  }

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
