import { NextResponse } from "next/server";
import { FOURNISSEURS, jetonAcces } from "@/lib/exportsStockage";

// Documents des logiciels de la suite (Go-Page, Calky) enregistrés dans le OneDrive / Google Drive de l'entreprise,
// dans le dossier « Gozly > Documents ». Les logiciels passent par le serveur : la connexion OAuth est celle déjà faite
// dans Paramètres > Intégrations, ils n'ont donc rien à connecter eux-mêmes.

export const DOSSIER_DOCUMENTS = ["Gozly", "Documents"];
export const TAILLE_MAX_DOCUMENT = 4 * 1024 * 1024; // limite de Vercel : ~4,5 Mo par requête
const EXTENSIONS_PERMISES = ["gozdoc", "calky", "docx", "xlsx", "csv", "pdf"];

// Nom de fichier sûr : pas de chemin, pas de caractères interdits, extension connue.
export function nomFichierValide(nom) {
  const propre = String(nom || "").trim();
  if (!propre || propre.length > 120) return null;
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(propre) || propre.startsWith(".")) return null;
  const extension = propre.split(".").pop().toLowerCase();
  return EXTENSIONS_PERMISES.includes(extension) ? propre : null;
}

export function typeMime(nom) {
  const ext = nom.split(".").pop().toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "csv") return "text/csv; charset=utf-8";
  return "application/json; charset=utf-8"; // .gozdoc et .calky sont du JSON
}

// La connexion de stockage de l'entreprise pour ce fournisseur, ou une réponse d'erreur prête à renvoyer.
export async function connexionPourNuage(service, entrepriseId, fournisseur) {
  if (!FOURNISSEURS[fournisseur]) return { erreur: NextResponse.json({ error: "Fournisseur inconnu." }, { status: 400 }) };
  const { data: connexion } = await service
    .from("stockage_connexions")
    .select("*")
    .eq("entreprise_id", entrepriseId)
    .eq("fournisseur", fournisseur)
    .maybeSingle();
  if (!connexion || connexion.statut !== "connecte") {
    return { erreur: NextResponse.json({ error: `${FOURNISSEURS[fournisseur].nom} n'est pas connecté pour cette entreprise.` }, { status: 400 }) };
  }
  return { connexion };
}

// Jeton d'accès frais + bibliothèque du fournisseur. En cas d'échec, la connexion est marquée à reconnecter si Microsoft/Google la refuse.
export async function accesNuage(service, connexion) {
  const fournisseur = FOURNISSEURS[connexion.fournisseur];
  try {
    return { accessToken: await jetonAcces(service, connexion), lib: fournisseur.lib, nom: fournisseur.nom };
  } catch (erreur) {
    const expire = erreur?.code === "invalid_grant" || erreur?.code === "interaction_required";
    if (expire) {
      await service
        .from("stockage_connexions")
        .update({ statut: "a_reconnecter", derniere_erreur: `La connexion à ${fournisseur.nom} a expiré : reconnecte ton compte.`, updated_at: new Date().toISOString() })
        .eq("id", connexion.id);
    }
    return {
      erreur: NextResponse.json(
        { error: expire ? `La connexion à ${fournisseur.nom} a expiré. Reconnecte-la dans Paramètres > Intégrations sur gozly.net.` : `${fournisseur.nom} est inaccessible pour le moment.` },
        { status: 502 }
      ),
    };
  }
}
