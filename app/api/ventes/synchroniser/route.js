import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { synchroniserVentesWix } from "@/lib/ventesWix";

// Importer 30 jours de point de vente peut demander plusieurs pages de
// résultats chez Wix : on laisse plus de temps que le défaut.
export const maxDuration = 60;

// Importe les ventes Wix (en ligne + point de vente) dans le Suivi des ventes.
// `jours` : combien de jours en arrière (3 par défaut pour la synchro
// automatique à l'ouverture de la page, 30 pour l'import manuel).
export async function POST(request) {
  const { entrepriseId, jours } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!entreprise) {
    return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "La synchronisation Wix n'est pas encore configurée." }, { status: 501 });
  }

  const { data: connexion } = await service
    .from("wix_connexions")
    .select("instance_id, statut")
    .eq("entreprise_id", entreprise.id)
    .maybeSingle();

  if (connexion?.statut !== "connecte" || !connexion.instance_id) {
    return NextResponse.json({ error: "Wix n'est pas connecté. Va dans Paramètres → Intégrations." }, { status: 400 });
  }

  try {
    const resultat = await synchroniserVentesWix(service, entreprise.id, connexion.instance_id, jours);
    return NextResponse.json({ ok: true, ...resultat });
  } catch (err) {
    console.error("Erreur import des ventes Wix:", err.message);
    return NextResponse.json({ error: "L'import des ventes Wix a échoué.", detail: err.message }, { status: 502 });
  }
}
