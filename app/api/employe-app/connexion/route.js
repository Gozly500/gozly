import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { genererToken, hashToken } from "@/lib/employeSession";

// Un NIP fait seulement 4 chiffres (10 000 combinaisons) - sans limite,
// quelqu'un qui connaît (ou devine) un code d'entreprise pourrait
// essayer systématiquement tous les NIP. Fenêtre glissante par code
// d'entreprise plutôt que par IP (plus simple, et couvre aussi le cas
// où l'attaquant change d'IP).
const FENETRE_MINUTES = 15;
const MAX_TENTATIVES = 15;

export async function POST(request) {
  const { codeAcces, nip } = await request.json().catch(() => ({}));

  if (!codeAcces?.trim() || !nip?.trim()) {
    return NextResponse.json({ error: "Code d'entreprise et NIP requis." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "La connexion n'est pas encore configurée." }, { status: 501 });
  }

  const codeNormalise = codeAcces.trim().toUpperCase();

  const depuis = new Date(Date.now() - FENETRE_MINUTES * 60 * 1000).toISOString();
  const { count: tentativesRecentes } = await service
    .from("employe_connexion_tentatives")
    .select("id", { count: "exact", head: true })
    .eq("code_acces", codeNormalise)
    .gte("created_at", depuis);

  if ((tentativesRecentes || 0) >= MAX_TENTATIVES) {
    return NextResponse.json({ error: "Trop de tentatives. Réessaie dans quelques minutes." }, { status: 429 });
  }

  async function enregistrerEchec() {
    await service.from("employe_connexion_tentatives").insert({ code_acces: codeNormalise });
  }

  const { data: entreprise } = await service
    .from("entreprises")
    .select("id, nom")
    .eq("code_acces", codeNormalise)
    .maybeSingle();

  if (!entreprise) {
    await enregistrerEchec();
    return NextResponse.json({ error: "Code d'entreprise introuvable." }, { status: 401 });
  }

  const { data: employe } = await service
    .from("employes")
    .select("id, nom")
    .eq("entreprise_id", entreprise.id)
    .eq("nip", nip.trim())
    .maybeSingle();

  if (!employe) {
    await enregistrerEchec();
    return NextResponse.json({ error: "NIP incorrect." }, { status: 401 });
  }

  const token = genererToken();

  const { error } = await service.from("employe_sessions").insert({
    employe_id: employe.id,
    token_hash: hashToken(token),
  });

  if (error) {
    console.error("Erreur création session employé:", error);
    return NextResponse.json({ error: "La connexion a échoué." }, { status: 500 });
  }

  return NextResponse.json({
    token,
    employe: { id: employe.id, nom: employe.nom },
    entreprise: { id: entreprise.id, nom: entreprise.nom },
  });
}
