import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { construireBonCommande } from "@/lib/impressionCommandes";

// Configuration de l'impression des bons de commande (Personnalisation >
// Commandes en ligne) : active/désactive, génère l'URL secrète à copier dans
// la configuration de l'imprimante Epson, et envoie un bon de test.
// Le jeton ne sort jamais d'ici : l'interface ne le lit pas directement.

export async function POST(request) {
  const { entrepriseId, action } = await request.json().catch(() => ({}));

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

  const origine = new URL(request.url).origin;
  const urlImprimante = (jeton) => `${origine}/api/impression/epson/${jeton}`;

  const { data: actuelle } = await service
    .from("entreprises")
    .select("impression_actif, impression_token")
    .eq("id", entreprise.id)
    .maybeSingle();

  if (action === "etat") {
    return NextResponse.json({
      actif: !!actuelle?.impression_actif,
      url: actuelle?.impression_actif && actuelle.impression_token ? urlImprimante(actuelle.impression_token) : null,
    });
  }

  // Aperçu : le bon tel que l'imprimante le recevrait, avec une commande d'exemple et avec la dernière
  // vraie commande (s'il y en a une). Fonctionne même si l'impression n'est pas encore activée.
  if (action === "apercu") {
    const { data: ent } = await service.from("entreprises").select("nom").eq("id", entreprise.id).maybeSingle();
    const { data: derniere } = await service
      .from("commandes_en_ligne")
      .select("*")
      .eq("entreprise_id", entreprise.id)
      .neq("canal", "POS")
      .order("date_commande", { ascending: false })
      .limit(1)
      .maybeSingle();
    const maintenant = Date.now();
    const exemple = {
      numero: "M12",
      date_commande: new Date(maintenant).toISOString(),
      mode: "ramassage",
      date_ramassage: new Date(maintenant + 2 * 3600 * 1000).toISOString(),
      client_nom: "Marie Tremblay",
      client_telephone: "514 555-0123",
      items: [
        { nom: "Pizza au tomate", quantite: 2, prix: 14.5, options: ["Taille: Grande"] },
        { nom: "Tiramisu", quantite: 1, prix: 8.5, options: [] },
      ],
      total: 37.5,
      statut_paiement: "NOT_PAID",
      note: "Sans oignons svp",
    };
    return NextResponse.json({
      exemple: construireBonCommande(exemple, ent?.nom || ""),
      derniere: derniere ? construireBonCommande(derniere, ent?.nom || "") : null,
    });
  }

  if (action === "activer" || action === "regenerer") {
    // Régénérer invalide l'ancienne URL : l'imprimante doit recevoir la nouvelle.
    const jeton =
      action === "activer" && actuelle?.impression_token ? actuelle.impression_token : randomBytes(24).toString("hex");
    const { error } = await service
      .from("entreprises")
      .update({ impression_actif: true, impression_token: jeton })
      .eq("id", entreprise.id);
    if (error) {
      console.error("Erreur activation impression:", error.message);
      // Le plus souvent : commandes_impression.sql pas encore exécuté dans Supabase (colonnes manquantes).
      return NextResponse.json(
        { error: "Impossible d'activer l'impression. As-tu exécuté commandes_impression.sql dans Supabase?", detail: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ actif: true, url: urlImprimante(jeton) });
  }

  if (action === "desactiver") {
    await service.from("entreprises").update({ impression_actif: false, impression_token: null }).eq("id", entreprise.id);
    // Les bons encore en file ne serviraient plus à rien.
    await service.from("bons_impression").delete().eq("entreprise_id", entreprise.id).in("statut", ["en_attente", "envoye"]);
    return NextResponse.json({ actif: false, url: null });
  }

  if (action === "tester") {
    if (!actuelle?.impression_actif) {
      return NextResponse.json({ error: "Active d'abord l'impression." }, { status: 400 });
    }
    const { error } = await service.from("bons_impression").insert({ entreprise_id: entreprise.id, type: "test" });
    if (error) {
      return NextResponse.json({ error: "Impossible de lancer le test." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}
