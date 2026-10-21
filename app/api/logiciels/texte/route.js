import { NextResponse } from "next/server";
import { lienTemporaire, trouverInstallateur, verifierAccesTexte } from "@/lib/logicielsServer";

export const dynamic = "force-dynamic";

// GET /api/logiciels/texte            -> infos publiques (version, taille), sans lien de téléchargement
// GET /api/logiciels/texte?telecharger=1 + "Authorization: Bearer <session>" -> lien temporaire,
//     seulement si le forfait du compte inclut Gozly Texte.
export async function GET(request) {
  const installateur = await trouverInstallateur("texte");
  if (installateur.erreur) {
    // 200 même si rien n'est prêt: la page affiche simplement « Bientôt disponible »
    return NextResponse.json({ disponible: false, raison: installateur.erreur });
  }

  const { searchParams } = new URL(request.url);
  if (!searchParams.get("telecharger")) {
    return NextResponse.json({ disponible: true, version: installateur.version, taille: installateur.asset.taille });
  }

  const acces = await verifierAccesTexte(request);
  if (acces.reponse) return acces.reponse;

  let lien;
  try {
    lien = await lienTemporaire(installateur.asset.url);
  } catch (err) {
    console.error("[logiciels] Échec de la demande à GitHub:", err);
    return NextResponse.json({ error: "Le fichier n'est pas disponible pour le moment.", code: "reseau" }, { status: 502 });
  }
  if (!lien.url) {
    return NextResponse.json({ error: "Le fichier n'est pas disponible pour le moment.", code: `github_${lien.statut}` }, { status: 502 });
  }

  return NextResponse.json({ url: lien.url, version: installateur.version, nom: installateur.asset.nom });
}
