import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";

export async function POST(request) {
  const { entrepriseId, donnees } = await request.json().catch(() => ({}));

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
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
  if (service) {
    await service.from("wix_connexions").delete().eq("entreprise_id", entreprise.id);

    // Ce qui venait de Wix : « garder » (les produits et catégories deviennent des produits Gozly ordinaires, les commandes
    // et journées de ventes déjà importées restent) ou « supprimer » (tout ce qui vient de Wix disparaît).
    if (donnees === "supprimer") {
      await service.from("produits_inventaire").delete().eq("entreprise_id", entreprise.id).eq("source", "wix");
      await service.from("categories_inventaire").delete().eq("entreprise_id", entreprise.id).eq("source", "wix");
      await service.from("commandes_en_ligne").delete().eq("entreprise_id", entreprise.id).eq("source", "wix");
      await service.from("ventes_jours").delete().eq("entreprise_id", entreprise.id).eq("source", "wix");
    } else if (donnees === "garder") {
      await service.from("produits_inventaire").update({ source: null, source_id: null }).eq("entreprise_id", entreprise.id).eq("source", "wix");
      await service.from("categories_inventaire").update({ source: null, source_id: null }).eq("entreprise_id", entreprise.id).eq("source", "wix");
    }
  }

  return NextResponse.json({ ok: true });
}
