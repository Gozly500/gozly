import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { normaliserLieu } from "@/lib/wixLieu";
import { synchroniserTachesCommandes } from "@/lib/tachesCommandes";

// Choisit la succursale Wix dont ce dashboard reçoit les commandes
// (entreprises.wix_lieu_nom ; null = toutes). Quand une succursale est
// choisie, les commandes déjà copiées qui viennent d'une AUTRE succursale
// sont retirées de ce dashboard (celles sans lieu restent), et les tâches
// automatiques sont recalculées. Les ventes importées se corrigent à la
// prochaine synchro du Suivi des ventes.
export async function POST(request) {
  const { entrepriseId, lieu } = await request.json().catch(() => ({}));

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

  const lieuChoisi = typeof lieu === "string" && lieu.trim() ? lieu.trim() : null;

  const { error } = await service.from("entreprises").update({ wix_lieu_nom: lieuChoisi }).eq("id", entreprise.id);
  if (error) {
    return NextResponse.json({ error: "Impossible d'enregistrer la succursale.", detail: error.message }, { status: 500 });
  }

  let retirees = 0;
  if (lieuChoisi) {
    const { data: lignes } = await service
      .from("commandes_en_ligne")
      .select("id, lieu_nom")
      .eq("entreprise_id", entreprise.id)
      .eq("source", "wix")
      .not("lieu_nom", "is", null);

    const cible = normaliserLieu(lieuChoisi);
    const aRetirer = (lignes || []).filter((l) => normaliserLieu(l.lieu_nom) !== cible).map((l) => l.id);
    for (let i = 0; i < aRetirer.length; i += 200) {
      await service.from("commandes_en_ligne").delete().in("id", aRetirer.slice(i, i + 200));
    }
    retirees = aRetirer.length;
  }

  await synchroniserTachesCommandes(service, entreprise.id).catch((err) => console.error("Erreur tâches:", err.message));

  return NextResponse.json({ ok: true, retirees });
}
