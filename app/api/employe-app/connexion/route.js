import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { genererToken, hashToken } from "@/lib/employeSession";

export async function POST(request) {
  const { codeAcces, nip } = await request.json().catch(() => ({}));

  if (!codeAcces?.trim() || !nip?.trim()) {
    return NextResponse.json({ error: "Code d'entreprise et NIP requis." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "La connexion n'est pas encore configurée." }, { status: 501 });
  }

  const { data: entreprise, error: entrepriseError } = await service
    .from("entreprises")
    .select("id, nom")
    .eq("code_acces", codeAcces.trim().toUpperCase())
    .maybeSingle();

  if (!entreprise) {
    return NextResponse.json(
      { error: "Code d'entreprise introuvable.", debug: { codeRecu: codeAcces.trim().toUpperCase(), entrepriseError } },
      { status: 401 }
    );
  }

  const { data: employe, error: employeError } = await service
    .from("employes")
    .select("id, nom")
    .eq("entreprise_id", entreprise.id)
    .eq("nip", nip.trim())
    .maybeSingle();

  if (!employe) {
    return NextResponse.json(
      {
        error: "NIP incorrect.",
        debug: { entrepriseId: entreprise.id, nipRecu: nip.trim(), employeError },
      },
      { status: 401 }
    );
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
