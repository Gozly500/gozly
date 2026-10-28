import { NextResponse } from "next/server";
import { authentifierStockage } from "@/lib/stockageServer";
import { signerEtat } from "@/lib/stockageEtat";
import { urlAutorisation } from "@/lib/stockageGoogle";

// Prépare la connexion Google Drive : renvoie l'adresse de connexion Google vers laquelle envoyer le navigateur.
export async function POST(request) {
  const { entrepriseId } = await request.json().catch(() => ({}));

  const { entreprise, erreur } = await authentifierStockage(request, entrepriseId);
  if (erreur) return erreur;

  const manquantes = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "PAYROLL_ENCRYPTION_KEY"].filter((nom) => !process.env[nom]);
  if (manquantes.length > 0) {
    return NextResponse.json({ error: `La connexion à Google Drive n'est pas encore configurée (variable manquante : ${manquantes.join(", ")}).` }, { status: 501 });
  }

  const origine = new URL(request.url).origin;
  const etat = signerEtat({ entrepriseId: entreprise.id, origine });
  return NextResponse.json({ lien: urlAutorisation({ redirectUri: `${origine}/api/stockage/google/callback`, etat }) });
}
