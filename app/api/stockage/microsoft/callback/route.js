import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { encrypt } from "@/lib/paieCrypto";
import { echangerCode, lireEtat, lireProfil } from "@/lib/stockageMicrosoft";

// Retour de Microsoft après que le client a accepté la connexion : échange le code contre les jetons,
// les garde (chiffrés) pour l'entreprise indiquée dans l'état signé, puis ramène le client dans Paramètres.
export async function GET(request) {
  const url = new URL(request.url);
  const etat = lireEtat(url.searchParams.get("state"));
  if (!etat) {
    return NextResponse.json({ error: "Lien de connexion invalide ou expiré. Recommence depuis Gozly." }, { status: 400 });
  }

  const retour = (resultat) =>
    NextResponse.redirect(`${etat.origine}/dashboard/entreprise/parametres?onglet=integrations&stockage=${resultat}`);

  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) return retour("annule");

  const service = getServiceClient();
  if (!service) return retour("erreur");

  try {
    const { accessToken, refreshToken } = await echangerCode({
      code,
      redirectUri: `${etat.origine}/api/stockage/microsoft/callback`,
    });
    if (!refreshToken) return retour("erreur");

    const email = await lireProfil(accessToken);
    const { error } = await service.from("stockage_connexions").upsert(
      {
        entreprise_id: etat.entrepriseId,
        fournisseur: "microsoft",
        compte_email: email,
        jeton_actualisation_chiffre: encrypt(refreshToken),
        statut: "connecte",
        derniere_erreur: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entreprise_id,fournisseur" }
    );
    if (error) {
      console.error("Erreur enregistrement connexion OneDrive:", error);
      return retour("erreur");
    }
    return retour("ok");
  } catch (err) {
    console.error("Erreur connexion OneDrive:", err);
    return retour("erreur");
  }
}
