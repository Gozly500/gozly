import { NextResponse } from "next/server";
import { authentifierStockage } from "@/lib/stockageServer";
import { microsoftConfigure, signerEtat, urlAutorisation } from "@/lib/stockageMicrosoft";

// Prépare la connexion OneDrive : renvoie l'adresse de connexion Microsoft vers laquelle envoyer le navigateur.
export async function POST(request) {
  const { entrepriseId } = await request.json().catch(() => ({}));

  const { entreprise, erreur } = await authentifierStockage(request, entrepriseId);
  if (erreur) return erreur;

  if (!microsoftConfigure() || !process.env.PAYROLL_ENCRYPTION_KEY) {
    return NextResponse.json({ error: "La connexion à OneDrive n'est pas encore configurée." }, { status: 501 });
  }

  const origine = new URL(request.url).origin;
  const etat = signerEtat({ entrepriseId: entreprise.id, origine });
  return NextResponse.json({ lien: urlAutorisation({ redirectUri: `${origine}/api/stockage/microsoft/callback`, etat }) });
}
