import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { synchroniserTachesCommandes, retirerTachesCommandes } from "@/lib/tachesCommandes";

// Recalcule les tâches automatiques à partir des commandes (voir
// lib/tachesCommandes.js). Appelé après l'ajout / la modification / le
// retrait d'une commande manuelle, et quand on active l'option dans
// Personnalisation. (La synchro Wix le fait elle-même.)
export async function POST(request) {
  const { entrepriseId } = await request.json().catch(() => ({}));

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

  try {
    const { data: reglage } = await service.from("entreprises").select("commandes_vers_taches").eq("id", entreprise.id).maybeSingle();
    if (reglage && reglage.commandes_vers_taches === false) {
      await retirerTachesCommandes(service, entreprise.id);
      return NextResponse.json({ ok: true, resultat: null });
    }
    const resultat = await synchroniserTachesCommandes(service, entreprise.id);
    return NextResponse.json({ ok: true, resultat });
  } catch (err) {
    console.error("Erreur tâches automatiques:", err.message);
    return NextResponse.json({ error: "Impossible de mettre à jour les tâches.", detail: err.message }, { status: 500 });
  }
}
