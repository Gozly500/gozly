import { NextResponse } from "next/server";
import { authentifierStockage } from "@/lib/stockageServer";
import { DOSSIER_DOCUMENTS, TAILLE_MAX_DOCUMENT, accesNuage, connexionPourNuage, nomFichierValide, typeMime } from "@/lib/fichiersStockage";

// Liste les documents enregistrés dans « Gozly > Documents » du OneDrive / Google Drive de l'entreprise.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const entrepriseId = params.get("entrepriseId");
  const { service, entreprise, erreur } = await authentifierStockage(request, entrepriseId);
  if (erreur) return erreur;

  const { connexion, erreur: pasConnecte } = await connexionPourNuage(service, entreprise.id, params.get("fournisseur"));
  if (pasConnecte) return pasConnecte;
  const acces = await accesNuage(service, connexion);
  if (acces.erreur) return acces.erreur;

  try {
    const fichiers = await acces.lib.listerFichiers(acces.accessToken, DOSSIER_DOCUMENTS);
    return NextResponse.json({ fichiers });
  } catch (err) {
    console.error("Liste des documents du nuage:", err);
    return NextResponse.json({ error: `Impossible de lire la liste des fichiers de ${acces.nom}.` }, { status: 502 });
  }
}

// Enregistre (ou remplace) un document. Le fichier arrive tel quel dans le corps de la requête (octets bruts).
export async function POST(request) {
  const params = new URL(request.url).searchParams;
  const entrepriseId = params.get("entrepriseId");
  const nom = nomFichierValide(params.get("nom"));
  if (!nom) return NextResponse.json({ error: "Nom de fichier invalide." }, { status: 400 });

  const taille = Number(request.headers.get("content-length") || 0);
  if (taille > TAILLE_MAX_DOCUMENT) {
    return NextResponse.json({ error: "Le document est trop gros pour être enregistré dans le nuage (4 Mo maximum)." }, { status: 413 });
  }

  const { service, entreprise, erreur } = await authentifierStockage(request, entrepriseId);
  if (erreur) return erreur;
  const { connexion, erreur: pasConnecte } = await connexionPourNuage(service, entreprise.id, params.get("fournisseur"));
  if (pasConnecte) return pasConnecte;

  const octets = Buffer.from(await request.arrayBuffer());
  if (octets.length === 0) return NextResponse.json({ error: "Document vide." }, { status: 400 });
  if (octets.length > TAILLE_MAX_DOCUMENT) {
    return NextResponse.json({ error: "Le document est trop gros pour être enregistré dans le nuage (4 Mo maximum)." }, { status: 413 });
  }

  const acces = await accesNuage(service, connexion);
  if (acces.erreur) return acces.erreur;
  try {
    await acces.lib.deposerFichier(acces.accessToken, [...DOSSIER_DOCUMENTS, nom], octets, typeMime(nom));
    return NextResponse.json({ ok: true, nom });
  } catch (err) {
    console.error("Enregistrement dans le nuage:", err);
    return NextResponse.json({ error: `L'enregistrement dans ${acces.nom} a échoué.` }, { status: 502 });
  }
}
