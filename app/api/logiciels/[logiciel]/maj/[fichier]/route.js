import { NextResponse } from "next/server";
import { logicielExiste, lienTemporaire, trouverInstallateur, verifierAcces } from "@/lib/logicielsServer";

export const dynamic = "force-dynamic";

// Source des mises à jour automatiques des logiciels de bureau (le logiciel installé interroge cette adresse).
//   GET /api/logiciels/<logiciel>/maj/latest.yml                   -> décrit la dernière version
//   GET /api/logiciels/<logiciel>/maj/<Nom>-Setup-X.Y.Z.exe        -> l'installateur de cette version
// Chaque requête exige la session du compte (en-tête Authorization: Bearer ...) ET un forfait qui inclut le
// logiciel. Seuls les fichiers de la dernière publication sont servis, via un lien temporaire GitHub.
// Les logiciels déjà installés (Textas, ex-Go-Page) utilisent /api/logiciels/texte/maj : cette adresse ne doit pas changer.
export async function GET(request, { params }) {
  const logiciel = params.logiciel;
  if (!logicielExiste(logiciel)) return NextResponse.json({ error: "Logiciel inconnu." }, { status: 404 });

  const acces = await verifierAcces(request, logiciel);
  if (acces.reponse) return acces.reponse;

  const installateur = await trouverInstallateur(logiciel);
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
