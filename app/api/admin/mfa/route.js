import { NextResponse } from "next/server";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";

// Double authentification d'un compte client, vue de l'administration Gozly :
// - action "statut" : la double authentification est-elle activée ?
// - action "desactiver" : retire ses facteurs (cas d'un client qui n'a plus accès à son app d'authentification, par
//   téléphone). Le client pourra se reconnecter avec son mot de passe seulement, et la réactiver quand il veut.
// L'activation ne peut se faire que par le client lui-même (il doit scanner le code QR avec son téléphone).
export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  const { userId, action } = await request.json().catch(() => ({}));
  if (!userId || !["statut", "desactiver"].includes(action)) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const { data, error } = await service.auth.admin.mfa.listFactors({ userId });
  if (error) {
    return NextResponse.json({ error: "Lecture impossible : " + error.message }, { status: 500 });
  }
  const verifies = (data?.factors || []).filter((f) => f.status === "verified");

  if (action === "statut") {
    return NextResponse.json({ actif: verifies.length > 0 });
  }

  // On retire tous les facteurs (même ceux jamais confirmés) pour repartir à zéro.
  for (const f of data?.factors || []) {
    const { error: erreurRetrait } = await service.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (erreurRetrait) {
      return NextResponse.json({ error: "La désactivation a échoué : " + erreurRetrait.message }, { status: 500 });
    }
  }
  return NextResponse.json({ actif: false });
}
