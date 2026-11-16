import { NextResponse } from "next/server";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";
import { obtenirJetonWix, listerFulfillmentsWix, changerStatutFulfillmentWix, STATUTS_WIX } from "@/lib/wixClient";

export const dynamic = "force-dynamic";

// Outil de support (admin seulement) pour essayer les statuts de commande Wix Restaurants sur une vraie connexion.
//  - { entrepriseId }                                  : les 5 dernières commandes avec leurs fulfillments (lecture seule) ;
//  - { entrepriseId, orderId, statut }                 : change le statut du fulfillment d'UNE commande créée à la main dans le
//                                                        tableau de bord Wix (canal BACKOFFICE_MERCHANT). Jamais une commande de client.
export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  const { entrepriseId, orderId, statut } = await request.json().catch(() => ({}));
  const { data: connexion } = await service.from("wix_connexions").select("instance_id, statut").eq("entreprise_id", entrepriseId).maybeSingle();
  if (connexion?.statut !== "connecte" || !connexion.instance_id) return NextResponse.json({ error: "Wix n'est pas connecté pour cette entreprise." }, { status: 400 });
  const jeton = await obtenirJetonWix(connexion.instance_id).catch(() => null);
  if (!jeton) return NextResponse.json({ error: "Jeton Wix refusé." }, { status: 502 });

  if (!orderId) {
    const res = await fetch("https://www.wixapis.com/ecom/v1/orders/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: jeton },
      body: JSON.stringify({ search: { cursorPaging: { limit: 5 }, sort: [{ fieldName: "createdDate", order: "DESC" }] } }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: "Lecture des commandes impossible.", http: res.status, detail: JSON.stringify(json).slice(0, 300) }, { status: 502 });
    const commandes = [];
    for (const o of json.orders || []) {
      const f = await listerFulfillmentsWix(connexion.instance_id, o.id, jeton);
      commandes.push({
        id: o.id,
        numero: o.number,
        creee: o.createdDate,
        canal: o.channelInfo?.type || null,
        statut: o.status,
        fulfillmentStatus: o.fulfillmentStatus,
        paiement: o.paymentStatus,
        fulfillments: f.ok ? f.fulfillments : { erreur: f.status, detail: f.detail },
      });
    }
    return NextResponse.json({ commandes });
  }

  if (!STATUTS_WIX.includes(statut)) return NextResponse.json({ error: "Statut invalide.", valeurs: STATUTS_WIX }, { status: 400 });
  const resCommande = await fetch(`https://www.wixapis.com/ecom/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: jeton } });
  const jsonCommande = await resCommande.json().catch(() => ({}));
  const canal = jsonCommande.order?.channelInfo?.type || null;
  if (canal !== "BACKOFFICE_MERCHANT") {
    return NextResponse.json({ error: "Seules les commandes créées à la main dans le tableau de bord Wix (BACKOFFICE_MERCHANT) peuvent être modifiées ici.", canal }, { status: 403 });
  }
  const avant = await listerFulfillmentsWix(connexion.instance_id, orderId, jeton);
  const cible = avant.fulfillments[0];
  if (!cible?.id) return NextResponse.json({ error: "Cette commande n'a aucun fulfillment.", avant }, { status: 409 });
  const patch = await changerStatutFulfillmentWix(connexion.instance_id, orderId, cible.id, statut, jeton);
  const apres = await listerFulfillmentsWix(connexion.instance_id, orderId, jeton);
  return NextResponse.json({ avant: avant.fulfillments, patch, apres: apres.fulfillments });
}
