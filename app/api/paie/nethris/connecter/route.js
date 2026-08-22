import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntreprise } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { encrypt } from "@/lib/paieCrypto";

export async function POST(request) {
  const { codeEntreprise, codeUtilisateur, motDePasse } = await request.json().catch(() => ({}));

  if (!codeEntreprise?.trim() || !codeUtilisateur?.trim() || !motDePasse?.trim()) {
    return NextResponse.json({ error: "Les 3 champs sont requis." }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntreprise(supabase, token);

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!entreprise) {
    return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "La connexion aux services de paie n'est pas encore configurée." }, { status: 501 });
  }

  let motDePasseChiffre;
  try {
    motDePasseChiffre = encrypt(motDePasse.trim());
  } catch (err) {
    console.error("Erreur chiffrement Nethris:", err);
    return NextResponse.json({ error: "La connexion aux services de paie n'est pas encore configurée." }, { status: 501 });
  }

  const { error } = await service.from("paie_connexions").upsert(
    {
      entreprise_id: entreprise.id,
      service: "nethris",
      code_entreprise: codeEntreprise.trim(),
      code_utilisateur: codeUtilisateur.trim(),
      mot_de_passe_chiffre: motDePasseChiffre,
      statut: "non_verifie",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entreprise_id,service" }
  );

  if (error) {
    console.error("Erreur connexion Nethris:", error);
    return NextResponse.json({ error: "La connexion a échoué." }, { status: 500 });
  }

  return NextResponse.json({ connecte: true });
}
