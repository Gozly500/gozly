import { NextResponse } from "next/server";
import { lienTemporaire, trouverInstallateur, verifierAccesTexte } from "@/lib/logicielsServer";

export const dynamic = "force-dynamic";

// Source des mises à jour automatiques de Go-Page (le logiciel installé interroge cette adresse).
//   GET /api/logiciels/texte/maj/latest.yml                   -> décrit la dernière version
//   GET /api/logiciels/texte/maj/Go-Page-Setup-X.Y.Z.exe  -> l'installateur de cette version
// Chaque requête exige la session du compte (en-tête Authorization: Bearer ...) ET un forfait qui inclut
// Go-Page. Seuls les fichiers de la dernière publication sont servis, via un lien temporaire GitHub.
export async function GET(request, { params }) {
  const acces = await verifierAccesTexte(request);
  if (acces.reponse) return acces.reponse;

  const installateur = await trouverInstallateur("texte");
  if (installateur.erreur) return NextResponse.json({ error: "Aucune version disponible." }, { status: 404 });

  const nom = decodeURIComponent(params.fichier || "");
  const fichier = installateur.fichiers.find((f) => f.nom === nom);
  if (!fichier) return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });

  let lien;
  try {
    lien = await lienTemporaire(fichier.url);
  } catch (err) {
    console.error("[logiciels/maj] Échec de la demande à GitHub:", err);
    return NextResponse.json({ error: "Indisponible pour le moment." }, { status: 502 });
  }
  if (!lien.url) return NextResponse.json({ error: "Indisponible pour le moment." }, { status: 502 });

  return NextResponse.redirect(lien.url, 302);
}
