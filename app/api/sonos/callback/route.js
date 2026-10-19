import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { adresseRetour, configSonos, echangerCode, enregistrerJetons, lireState } from "@/lib/sonosServer";

// Retour de Sonos après l'autorisation : on échange le code contre les jetons, puis on revient sur la page Musique.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const retour = (resultat) => NextResponse.redirect(`${origin}/dashboard/musique?sonos=${resultat}`);

  if (searchParams.get("error")) return retour("refuse");
  const state = lireState(searchParams.get("state"));
  const code = searchParams.get("code");
  if (!configSonos() || !state || !code) return retour("erreur");

  const service = getServiceClient();
  if (!service) return retour("erreur");
  try {
    const jetons = await echangerCode(code, adresseRetour(request));
    // Nouvelle liaison : on repart d'un foyer inconnu.
    await enregistrerJetons(service, state.entrepriseId, jetons, state.userId);
    await service.from("sonos_connexions").update({ household_id: null }).eq("entreprise_id", state.entrepriseId);
    return retour("ok");
  } catch (err) {
    console.error("Erreur liaison Sonos:", err.message);
    return retour("erreur");
  }
}
