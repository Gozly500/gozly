import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { synchroniserCommandesWix } from "@/lib/synchroCommandesWix";

// Copie (lecture seule) les commandes Wix récentes de l'entreprise dans
// commandes_en_ligne. Rejouable à volonté : chaque commande est mise à jour
// sur place (statut de paiement/préparation qui change, annulation...).
export async function POST(request) {
  const { entrepriseId, jours } = await request.json().catch(() => ({}));

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
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
    .select("*")
    .eq("entreprise_id", entreprise.id)
    .maybeSingle();

  if (connexion?.statut !== "connecte" || !connexion.instance_id) {
    return NextResponse.json({ error: "Wix n'est pas connecté. Va dans Paramètres → Intégrations." }, { status: 400 });
  }

  const r = await synchroniserCommandesWix(service, entreprise, connexion, { jours });
  return NextResponse.json(r.body, { status: r.status });
}
