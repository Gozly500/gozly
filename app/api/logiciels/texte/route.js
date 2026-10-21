import { NextResponse } from "next/server";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { forfaitPermetTexte } from "@/lib/logiciels";
import { lienTemporaire, trouverInstallateur } from "@/lib/logicielsServer";

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

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const supabase = getSupabaseForToken(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: profil } = await supabase.from("profils").select("forfait").eq("id", user.id).maybeSingle();
  if (!forfaitPermetTexte(profil?.forfait)) {
    return NextResponse.json({ error: "Ton forfait ne comprend pas Gozly Texte." }, { status: 403 });
  }

  const url = await lienTemporaire(installateur.asset.url);
  if (!url) return NextResponse.json({ error: "Le fichier n'est pas disponible pour le moment." }, { status: 502 });

  return NextResponse.json({ url, version: installateur.version, nom: installateur.asset.nom });
}
