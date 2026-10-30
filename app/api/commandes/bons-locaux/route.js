import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { xmlDuBon } from "@/lib/impressionCommandes";

// Impression par la tablette (app Android du kiosque, Bluetooth) : au lieu que l'imprimante interroge Gozly en
// permanence (voir /api/impression/epson/[token]), le kiosque vient chercher les bons en attente, les envoie
// lui-même à l'imprimante, puis confirme le résultat. Aucune requête quand il n'y a rien à imprimer, à part
// la synchronisation que le kiosque fait déjà.
// - action "prendre" : réserve jusqu'à 5 bons en attente et rend leur XML ;
// - action "termine" : { bonId, succes, erreur } -> le bon passe à imprimé ou en échec.

const DELAI_REPONSE_MS = 60 * 1000; // un bon réservé sans résultat après ce délai est remis en file
const MAX_TENTATIVES = 3;
const MAX_PAR_APPEL = 5;

export async function POST(request) {
  const { entrepriseId, action, bonId, succes, erreur } = await request.json().catch(() => ({}));

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
    return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  }

  const { data: config } = await service.from("entreprises").select("nom, impression_actif").eq("id", entreprise.id).maybeSingle();
  if (!config?.impression_actif) return NextResponse.json({ bons: [] });

  if (action === "termine") {
    if (!bonId) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const { data: bon } = await service
      .from("bons_impression")
      .select("id, commande_id")
      .eq("id", bonId)
      .eq("entreprise_id", entreprise.id)
      .eq("statut", "envoye")
      .maybeSingle();
    if (!bon) return NextResponse.json({ ok: true });
    const maintenant = new Date().toISOString();
    if (succes) {
      await service.from("bons_impression").update({ statut: "imprime", updated_at: maintenant }).eq("id", bon.id);
      if (bon.commande_id) await service.from("commandes_en_ligne").update({ imprime_le: maintenant }).eq("id", bon.commande_id);
    } else {
      await service
        .from("bons_impression")
        .update({ statut: "echec", erreur: String(erreur || "Échec de l'impression").slice(0, 200), updated_at: maintenant })
        .eq("id", bon.id);
    }
    return NextResponse.json({ ok: true });
  }

  if (action !== "prendre") return NextResponse.json({ error: "Action invalide." }, { status: 400 });

  // Un bon réservé par une tablette qui s'est éteinte en route : on le remet en file (ou en échec après trop d'essais).
  const limite = new Date(Date.now() - DELAI_REPONSE_MS).toISOString();
  const { data: bloques } = await service
    .from("bons_impression")
    .select("id, tentatives")
    .eq("entreprise_id", entreprise.id)
    .eq("statut", "envoye")
    .lt("updated_at", limite);
  for (const b of bloques || []) {
    await service
      .from("bons_impression")
      .update(
        b.tentatives >= MAX_TENTATIVES
          ? { statut: "echec", erreur: "Pas de réponse de l'imprimante", updated_at: new Date().toISOString() }
          : { statut: "en_attente", updated_at: new Date().toISOString() }
      )
      .eq("id", b.id);
  }

  const { data: enAttente } = await service
    .from("bons_impression")
    .select("id, commande_id, type, tentatives")
    .eq("entreprise_id", entreprise.id)
    .eq("statut", "en_attente")
    .order("created_at", { ascending: true })
    .limit(MAX_PAR_APPEL);

  const bons = [];
  for (const bon of enAttente || []) {
    // Réservation : seulement si le bon est encore en attente (une autre tablette a pu le prendre juste avant).
    const { data: pris } = await service
      .from("bons_impression")
      .update({ statut: "envoye", tentatives: (bon.tentatives || 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", bon.id)
      .eq("statut", "en_attente")
      .select("id");
    if (!pris || pris.length === 0) continue;
    const xml = await xmlDuBon(service, config, bon);
    if (xml) bons.push({ id: bon.id, xml });
  }

  return NextResponse.json({ bons });
}
