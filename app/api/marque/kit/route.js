import { NextResponse } from "next/server";
import { creerZip } from "@/lib/zipSimple";
import { FICHIERS_KIT, couleursTxt, lisezMoi } from "@/lib/marque";

// Kit de marque en un seul fichier ZIP : logos, icônes, mascotte, pictogrammes, palette. Public (la marque est faite pour être partagée).
// Les fichiers sont lus par HTTP sur le site lui-même (le dossier /public n'est pas garanti en lecture disque sur l'hébergeur).
export async function GET(request) {
  const origine = new URL(request.url).origin;
  const fichiers = [
    { nom: "LISEZ-MOI.txt", contenu: lisezMoi() },
    { nom: "couleurs.txt", contenu: couleursTxt() },
  ];

  const lus = await Promise.all(
    FICHIERS_KIT.map(async ([chemin, dansZip]) => {
      try {
        const res = await fetch(`${origine}/${chemin}`);
        if (!res.ok) return null;
        return { nom: dansZip, contenu: Buffer.from(await res.arrayBuffer()) };
      } catch {
        return null;
      }
    })
  );
  fichiers.push(...lus.filter(Boolean));

  return new NextResponse(creerZip(fichiers), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="Gozly-kit-de-marque.zip"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
