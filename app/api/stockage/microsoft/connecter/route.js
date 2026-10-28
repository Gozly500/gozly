import { NextResponse } from "next/server";
import { authentifierStockage } from "@/lib/stockageServer";
import { signerEtat, urlAutorisation } from "@/lib/stockageMicrosoft";

// Prépare la connexion OneDrive : renvoie l'adresse de connexion Microsoft vers laquelle envoyer le navigateur.
export async function POST(request) {
  const { entrepriseId } = await request.json().catch(() => ({}));

  const { entreprise, erreur } = await authentifierStockage(request, entrepriseId);
  if (erreur) return erreur;

  const manquantes = ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "PAYROLL_ENCRYPTION_KEY"].filter((nom) => !process.env[nom]);
  if (manquantes.length > 0) {
    return NextResponse.json({ error: `La connexion à OneDrive n'est pas encore configurée (variable manquante : ${manquantes.join(", ")}).` }, { status: 501 });
  }

  const origine = new URL(request.url).origin;
  const etat = signerEtat({ entrepriseId: entreprise.id, origine });
  return NextResponse.json({ lien: urlAutorisation({ redirectUri: `${origine}/api/stockage/microsoft/callback`, etat }) });
}
