import { getServiceClient } from "@/lib/adminServer";
import { construireBonCommande, construireBonTest } from "@/lib/impressionCommandes";

// Point d'accès interrogé par l'imprimante Epson TM-m30III (Server Direct
// Print) : elle envoie un POST toutes les quelques secondes à l'URL réglée
// dans son Web Config. Deux sortes de requêtes (form-urlencoded) :
// - ConnectionType=GetRequest : "as-tu un bon pour moi ?" -> on répond avec
//   un bon en ePOS-Print XML, ou une réponse vide s'il n'y en a pas ;
// - ConnectionType=SetResponse : le résultat de l'impression précédente.
// L'authentification, c'est le jeton secret dans l'URL (l'imprimante ne
// peut pas envoyer de session Gozly).

export const dynamic = "force-dynamic";

const DELAI_REPONSE_MS = 60 * 1000; // sans résultat après ce délai, on réessaie le bon
const MAX_TENTATIVES = 3;

function reponseVide() {
  return new Response(null, { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8", "Content-Length": "0" } });
}

function reponseXml(xml) {
  return new Response(xml, { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

export async function POST(request, { params }) {
  const service = getServiceClient();
  if (!service || !params.token || params.token.length < 20) return reponseVide();

  const { data: entreprise } = await service
    .from("entreprises")
    .select("id, nom, impression_actif")
    .eq("impression_token", params.token)
    .maybeSingle();
  if (!entreprise || !entreprise.impression_actif) return reponseVide();

  const form = new URLSearchParams(await request.text().catch(() => ""));
  const type = form.get("ConnectionType");

  if (type === "SetResponse") {
    // Résultat du dernier bon envoyé (un seul à la fois : voir plus bas).
    const resultat = form.get("ResponseFile") || "";
    const succes = /success\s*=\s*"true"/i.test(resultat);

    const { data: bon } = await service
      .from("bons_impression")
      .select("id, commande_id, type")
      .eq("entreprise_id", entreprise.id)
      .eq("statut", "envoye")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bon) {
      const maintenant = new Date().toISOString();
      if (succes) {
        await service.from("bons_impression").update({ statut: "imprime", updated_at: maintenant }).eq("id", bon.id);
        if (bon.commande_id) {
          await service.from("commandes_en_ligne").update({ imprime_le: maintenant }).eq("id", bon.commande_id);
        }
      } else {
        const code = /code\s*=\s*"([^"]*)"/i.exec(resultat)?.[1] || "inconnu";
        await service.from("bons_impression").update({ statut: "echec", erreur: code, updated_at: maintenant }).eq("id", bon.id);
      }
    }
    return reponseVide();
  }

  if (type !== "GetRequest") return reponseVide();

  // Un seul bon en vol à la fois : le résultat (SetResponse) ne dit pas de
  // quel bon il s'agit. Si un bon attend son résultat depuis trop longtemps,
  // on le remet en file (ou en échec après trop de tentatives).
  const { data: enVol } = await service
    .from("bons_impression")
    .select("id, updated_at, tentatives")
    .eq("entreprise_id", entreprise.id)
    .eq("statut", "envoye")
    .limit(1)
    .maybeSingle();

  if (enVol) {
    if (Date.now() - new Date(enVol.updated_at).getTime() < DELAI_REPONSE_MS) return reponseVide();
    await service
      .from("bons_impression")
      .update(
        enVol.tentatives >= MAX_TENTATIVES
          ? { statut: "echec", erreur: "Pas de réponse de l'imprimante", updated_at: new Date().toISOString() }
          : { statut: "en_attente", updated_at: new Date().toISOString() }
      )
      .eq("id", enVol.id);
  }

  const { data: bon } = await service
    .from("bons_impression")
    .select("id, commande_id, type, tentatives")
    .eq("entreprise_id", entreprise.id)
    .eq("statut", "en_attente")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!bon) return reponseVide();

  let xml;
  if (bon.type === "test") {
    xml = construireBonTest(entreprise.nom);
  } else {
    const { data: commande } = await service.from("commandes_en_ligne").select("*").eq("id", bon.commande_id).maybeSingle();
    if (!commande) {
      await service.from("bons_impression").update({ statut: "echec", erreur: "Commande introuvable", updated_at: new Date().toISOString() }).eq("id", bon.id);
      return reponseVide();
    }
    xml = construireBonCommande(commande, entreprise.nom);
  }

  await service
    .from("bons_impression")
    .update({ statut: "envoye", tentatives: (bon.tentatives || 0) + 1, updated_at: new Date().toISOString() })
    .eq("id", bon.id);

  return reponseXml(xml);
}

// Utile pour tester l'URL dans un navigateur (l'imprimante, elle, fait un POST).
export async function GET() {
  return reponseVide();
}
