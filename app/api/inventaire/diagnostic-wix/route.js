import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { diagnostiquerInventaireWix } from "@/lib/wixClient";

// Montre ce que Wix répond pour les produits (voir diagnostiquerInventaireWix) : sert à comprendre
// pourquoi des produits Wix n'arrivent pas dans l'inventaire. Lecture seule.
export async function POST(request) {
  const { entrepriseId, terme } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!entreprise) return NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 });

  const service = getServiceClient();
  const { data: connexion } = await service
    .from("wix_connexions")
    .select("instance_id, statut")
    .eq("entreprise_id", entreprise.id)
    .maybeSingle();
  if (connexion?.statut !== "connecte" || !connexion.instance_id) {
    return NextResponse.json({ error: "Wix n'est pas connecté." }, { status: 400 });
  }

  try {
    const diagnostic = await diagnostiquerInventaireWix(connexion.instance_id, String(terme || ""));
    return NextResponse.json({ diagnostic });
  } catch (err) {
    return NextResponse.json({ error: "Le diagnostic a échoué.", detail: err.message }, { status: 502 });
  }
}
