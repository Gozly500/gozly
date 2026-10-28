import { NextResponse } from "next/server";
import { logicielExiste, lienTemporaire, trouverInstallateur, verifierAcces } from "@/lib/logicielsServer";

export const dynamic = "force-dynamic";

// GET /api/logiciels/<logiciel>            -> infos publiques (version, taille), sans lien de téléchargement
// GET /api/logiciels/<logiciel>?telecharger=1 + "Authorization: Bearer <session>" -> lien temporaire,
//     seulement si le forfait du compte inclut ce logiciel. <logiciel> = texte (Textas), calky...
export async function GET(request, { params }) {
  const logiciel = params.logiciel;
  if (!logicielExiste(logiciel)) return NextResponse.json({ error: "Logiciel inconnu." }, { status: 404 });

  const installateur = await trouverInstallateur(logiciel);
  if (installateur.erreur) {
    // 200 même si rien n'est prêt: la page affiche simplement « Bientôt disponible »
    return NextResponse.json({ disponible: false, raison: installateur.erreur });
  }

  const { searchParams } = new URL(request.url);
  if (!searchParams.get("telecharger")) {
    return NextResponse.json({ disponible: true, version: installateur.version, taille: installateur.asset.taille });
  }

  const acces = await verifierAcces(request, logiciel);
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
