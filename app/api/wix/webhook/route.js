import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getServiceClient } from "@/lib/adminServer";
import { verifierWebhookWix } from "@/lib/wixClient";
import { synchroniserCommandesWix } from "@/lib/synchroCommandesWix";

// Webhooks de Wix (app « Gozly connect »). Le type de message (eventType) décide de ce qu'on fait :
//  - installation de l'app : on associe l'instanceId à la plus vieille ligne « en_attente » de wix_connexions ;
//  - commande créée / approuvée / modifiée : on synchronise les commandes de l'entreprise tout de suite
//    (au lieu de demander à Wix toutes les 30 s). Les messages en double sont sans danger : la synchro est rejouable.
// Tout autre type est ignoré (200), pour ne jamais associer un site à la mauvaise entreprise.

const RE_INSTALLATION = /install/i;
const RE_COMMANDE = /order/i;

export async function POST(request) {
  const rawBody = await request.text();

  let event;
  try {
    event = verifierWebhookWix(rawBody);
  } catch (err) {
    console.error("Signature webhook Wix invalide:", err.message);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  const instanceId = event.instanceId;
  const type = String(event.eventType || "");
  if (!instanceId) {
    return NextResponse.json({ ok: true });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ ok: true });
  }

  if (RE_COMMANDE.test(type)) {
    // On répond tout de suite à Wix, et la synchro se fait après.
    waitUntil(synchroniserApresCommande(service, instanceId).catch((err) => console.error("Erreur synchro par webhook:", err?.message || err)));
    return NextResponse.json({ ok: true });
  }

  // Sans type connu, on garde l'ancien comportement (installation) ; sinon seulement un type « installation ».
  if (type && !RE_INSTALLATION.test(type)) {
    return NextResponse.json({ ok: true });
  }

  const { data: enAttente, error } = await service
    .from("wix_connexions")
    .select("id")
    .eq("statut", "en_attente")
    .is("instance_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erreur lecture wix_connexions (table absente ? voir supabase/wix_connexions.sql):", error.message);
  } else if (enAttente) {
    await service.from("wix_connexions").update({ instance_id: instanceId, statut: "connecte" }).eq("id", enAttente.id);
  } else {
    console.warn("Webhook Wix reçu (instanceId " + instanceId + ") sans ligne en_attente correspondante.");
  }

  return NextResponse.json({ ok: true });
}

// Un même site Wix peut alimenter plusieurs entreprises Gozly (une par succursale) : on les synchronise toutes.
async function synchroniserApresCommande(service, instanceId) {
  const { data: connexions } = await service.from("wix_connexions").select("*").eq("instance_id", instanceId).eq("statut", "connecte");
  for (const connexion of connexions || []) {
    const maintenant = new Date().toISOString();
    // Colonne absente (wix_webhook_commandes.sql pas exécuté) : l'erreur est ignorée, la synchro se fait quand même.
    await service.from("wix_connexions").update({ dernier_evenement_commande: maintenant }).eq("id", connexion.id).then(() => {}, () => {});
    const { data: entreprise } = await service.from("entreprises").select("*").eq("id", connexion.entreprise_id).maybeSingle();
    if (!entreprise) continue;
    // Deux jours suffisent : le webhook ne concerne que des commandes récentes.
    const r = await synchroniserCommandesWix(service, entreprise, { ...connexion, dernier_evenement_commande: maintenant }, { jours: 2 });
    if (r.status >= 400) console.error("Synchro par webhook en échec (" + r.status + "):", r.body?.error || "");
  }
}
