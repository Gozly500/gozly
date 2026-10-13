import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { creerRappel } from "@/lib/rappelsServer";

// Rappel créé par le propriétaire depuis le dashboard (Discussion > + Nouveau > Rappel).
export async function POST(request) {
  const { entrepriseId, contenu, dureeHeures, pourTous, employeIds } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user || !entreprise) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  }

  const { data: profil } = await service.from("profils").select("full_name").eq("id", user.id).maybeSingle();

  const resultat = await creerRappel(service, {
    entrepriseId: entreprise.id,
    contenu,
    dureeHeures,
    pourTous: !!pourTous,
    employeIds,
    auteur: { userId: user.id, nom: profil?.full_name || "Direction" },
  });

  if (resultat.erreur) {
    return NextResponse.json({ error: resultat.erreur }, { status: resultat.statut });
  }
  return NextResponse.json({ ok: true, rappelId: resultat.rappel.id, nbDestinataires: resultat.nbDestinataires });
}
