import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { synchroniserTachesCommandes } from "@/lib/tachesCommandes";
import { formaterTelephone } from "@/lib/telephone";

// Modifie une commande en ligne (Wix) depuis Gozly : client, ramassage, articles, note. Wix reste en lecture seule,
// donc la modification n'existe que dans Gozly ; `modifiee_gozly` dit à la synchronisation de ne pas l'écraser.
// (Les commandes saisies à la main se modifient directement, sans passer par ici.)
export async function POST(request) {
  const { entrepriseId, commandeId, commande: corps } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!commandeId || !corps || !Array.isArray(corps.items)) {
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

  const { data: existante } = await service
    .from("commandes_en_ligne")
    .select("id, source, total")
    .eq("id", commandeId)
    .eq("entreprise_id", entreprise.id)
    .maybeSingle();
  if (!existante) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  const items = corps.items
    .map((it) => ({
      nom: String(it.nom || "").trim().slice(0, 200),
      quantite: Math.floor(Number(it.quantite)) || 0,
      prix: Number.isFinite(Number(it.prix)) && it.prix !== null && it.prix !== "" ? Number(it.prix) : null,
      produit_id: it.produit_id || null,
      sku: it.sku || null,
      options: Array.isArray(it.options) ? it.options.map((o) => String(o).slice(0, 200)).slice(0, 20) : [],
    }))
    .filter((it) => it.nom && it.quantite > 0);
  if (items.length === 0) {
    return NextResponse.json({ error: "Ajoute au moins un article." }, { status: 400 });
  }

  const dateValide = (v) => {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  };
  const dateRamassage = corps.date_ramassage ? dateValide(corps.date_ramassage) : null;
  let dateRamassageFin = corps.date_ramassage_fin && dateRamassage ? dateValide(corps.date_ramassage_fin) : null;
  if (dateRamassageFin && Date.parse(dateRamassageFin) <= Date.parse(dateRamassage)) dateRamassageFin = null;

  // Total recalculé seulement si tous les articles ont un prix (sinon on garde celui de la commande).
  const total = items.every((it) => it.prix != null)
    ? Math.round(items.reduce((somme, it) => somme + it.quantite * it.prix, 0) * 100) / 100
    : existante.total;

  const telephone = formaterTelephone(corps.client_telephone);
  const champs = {
    client_nom: String(corps.client_nom || "").trim().slice(0, 120) || null,
    mode: corps.mode === "livraison" ? "livraison" : "ramassage",
    date_ramassage: dateRamassage,
    date_ramassage_fin: dateRamassageFin,
    items,
    total,
    modifiee_gozly: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await service.from("commandes_en_ligne").update(champs).eq("id", existante.id);
  if (error) {
    console.error("Erreur modification commande:", error.message);
    return NextResponse.json(
      { error: "Impossible de modifier la commande. As-tu exécuté commandes_annulation_modif.sql dans Supabase?", detail: error.message },
      { status: 500 }
    );
  }

  // Téléphone et note : écrits à part (colonnes de commandes_telephone.sql et commandes_note.sql).
  await service.from("commandes_en_ligne").update({ client_telephone: telephone || null }).eq("id", existante.id);
  await service.from("commandes_en_ligne").update({ note: String(corps.note || "").trim().slice(0, 500) || null }).eq("id", existante.id);

  await synchroniserTachesCommandes(service, entreprise.id).catch((err) => console.error("Erreur tâches automatiques:", err.message));

  return NextResponse.json({ ok: true });
}
