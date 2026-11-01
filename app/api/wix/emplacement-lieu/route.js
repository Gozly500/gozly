import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { normaliserLieu } from "@/lib/wixLieu";
import { synchroniserTachesCommandes } from "@/lib/tachesCommandes";

// Lie une succursale (emplacement) Gozly à une succursale Wix (emplacements.wix_lieu_nom ; null = pas de lien).
// Quand TOUTES les succursales du dashboard sont liées, les commandes déjà copiées qui viennent d'un autre
// lieu sont retirées (celles sans lieu restent), comme le réglage « Succursale Wix de ce dashboard », et les
// tâches automatiques sont recalculées.
export async function POST(request) {
  const { entrepriseId, emplacementId, lieu } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!entreprise || !emplacementId) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  }

  const lieuChoisi = typeof lieu === "string" && lieu.trim() ? lieu.trim() : null;

  const { error } = await service
    .from("emplacements")
    .update({ wix_lieu_nom: lieuChoisi })
    .eq("id", emplacementId)
    .eq("entreprise_id", entreprise.id);
  if (error) {
    return NextResponse.json(
      { error: "Impossible d'enregistrer le lien. As-tu exécuté emplacements_wix_lieu.sql dans Supabase ?", detail: error.message },
      { status: 500 }
    );
  }

  let retirees = 0;
  const { data: emplacements } = await service.from("emplacements").select("*").eq("entreprise_id", entreprise.id);
  const liens = (emplacements || []).map((e) => e.wix_lieu_nom).filter(Boolean);
  if (emplacements?.length && liens.length === emplacements.length && !entreprise.wix_lieu_nom) {
    const cibles = new Set(liens.map(normaliserLieu));
    const { data: lignes } = await service
      .from("commandes_en_ligne")
      .select("id, lieu_nom")
      .eq("entreprise_id", entreprise.id)
      .eq("source", "wix")
      .not("lieu_nom", "is", null);
    const aRetirer = (lignes || []).filter((l) => !cibles.has(normaliserLieu(l.lieu_nom))).map((l) => l.id);
    for (let i = 0; i < aRetirer.length; i += 200) {
      await service.from("commandes_en_ligne").delete().in("id", aRetirer.slice(i, i + 200));
    }
    retirees = aRetirer.length;
  }

  await synchroniserTachesCommandes(service, entreprise.id).catch((err) => console.error("Erreur tâches:", err.message));

  return NextResponse.json({ ok: true, retirees });
}
