// Accès aux installateurs des logiciels de bureau, stockés dans les publications (Releases) du
// dépôt PRIVÉ Gozly500/gozly-suite. Le fichier n'est jamais public : le serveur demande à GitHub
// un lien temporaire (quelques minutes) seulement après avoir vérifié le forfait du compte.
//
// Variable d'environnement requise (Vercel, marquée "Sensitive") :
//   GITHUB_LOGICIELS_TOKEN = clé d'accès GitHub à granularité fine, lecture seule ("Contents: Read-only")
//   sur le dépôt gozly-suite uniquement.
//
// Convention de publication : une Release par version, avec une étiquette "texte-v0.1.0" et le fichier
// "Gozly-Texte-Setup-0.1.0.exe" en pièce jointe.

const DEPOT = "Gozly500/gozly-suite";
const API = "https://api.github.com";

const LOGICIELS = {
  texte: { prefixeEtiquette: "texte-v", motifFichier: /^Gozly-Texte-Setup-.*\.exe$/ },
};

import { NextResponse } from "next/server";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { forfaitPermetTexte } from "@/lib/logiciels";

export const configurationGithubComplete = () => Boolean(process.env.GITHUB_LOGICIELS_TOKEN);

function entetes(accept = "application/vnd.github+json") {
  return {
    Authorization: `Bearer ${process.env.GITHUB_LOGICIELS_TOKEN}`,
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gozly-site",
  };
}

// Dernière version publiée d'un logiciel : { version, asset: { url, nom, taille } } ou { erreur }
export async function trouverInstallateur(logiciel) {
  const def = LOGICIELS[logiciel];
  if (!def) return { erreur: "logiciel_inconnu" };
  if (!configurationGithubComplete()) return { erreur: "non_configure" };

  const reponse = await fetch(`${API}/repos/${DEPOT}/releases?per_page=30`, {
    headers: entetes(),
    next: { revalidate: 300 },
  });
  if (!reponse.ok) return { erreur: `github_${reponse.status}` };

  const releases = await reponse.json();
  for (const release of releases) {
    if (release.draft || release.prerelease || !release.tag_name.startsWith(def.prefixeEtiquette)) continue;
    const fichier = (release.assets || []).find((a) => def.motifFichier.test(a.name));
    if (fichier) {
      return {
        version: release.tag_name.slice(def.prefixeEtiquette.length),
        asset: { url: fichier.url, nom: fichier.name, taille: fichier.size },
        // Tous les fichiers de la publication (installateur, latest.yml pour les mises à jour, ...)
        fichiers: release.assets.map((a) => ({ url: a.url, nom: a.name })),
      };
    }
  }
  return { erreur: "aucune_version" };
}

// Lien de téléchargement temporaire généré par GitHub : { url } ou { url: null, statut } si impossible
export async function lienTemporaire(assetUrl) {
  const reponse = await fetch(assetUrl, {
    headers: entetes("application/octet-stream"),
    redirect: "manual",
    cache: "no-store",
  });
  const destination = reponse.headers.get("location");
  if (reponse.status >= 300 && reponse.status < 400 && destination) return { url: destination };
  console.error("[logiciels] GitHub n'a pas donné de lien temporaire:", reponse.status, (await reponse.text().catch(() => "")).slice(0, 200));
  return { url: null, statut: reponse.status };
}

// Vérifie la session (en-tête Authorization: Bearer ...) et le forfait. Retourne { reponse } si refusé.
export async function verifierAccesTexte(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return { reponse: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };

  const supabase = getSupabaseForToken(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return { reponse: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };

  const { data: profil } = await supabase.from("profils").select("forfait").eq("id", user.id).maybeSingle();
  if (!forfaitPermetTexte(profil?.forfait)) {
    return { reponse: NextResponse.json({ error: "Ton forfait ne comprend pas Gozly Texte." }, { status: 403 }) };
  }
  return { user };
}
