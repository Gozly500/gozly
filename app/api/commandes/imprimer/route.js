import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { imprimerAutomatiquement, mettreEnFile } from "@/lib/impressionCommandes";

// Envoie le bon d'une commande à l'imprimante (via la file d'impression).
// - mode "manuel" : bouton Imprimer / Réimprimer, toujours accepté si
//   l'impression est configurée ;
// - mode "creation" : appelé juste après la création d'une commande
//   manuelle, n'imprime que si le réglage est "automatique".
export async function POST(request) {
  const { entrepriseId, commandeId, mode } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!commandeId) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
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
    return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  }

  if (mode === "creation") {
    const mis = await imprimerAutomatiquement(service, entreprise.id, commandeId, { aLaCreation: true });
    return NextResponse.json({ ok: true, enFile: mis });
  }

  const { data: config } = await service.from("entreprises").select("impression_actif").eq("id", entreprise.id).maybeSingle();
  if (!config?.impression_actif) {
    return NextResponse.json({ error: "L'impression n'est pas configurée (Personnalisation → Commandes en ligne)." }, { status: 400 });
  }

  const { data: commande } = await service
    .from("commandes_en_ligne")
    .select("id")
    .eq("id", commandeId)
    .eq("entreprise_id", entreprise.id)
    .maybeSingle();
  if (!commande) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  await mettreEnFile(service, entreprise.id, commande.id);
  return NextResponse.json({ ok: true, enFile: true });
}
