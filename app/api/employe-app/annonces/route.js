import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getBearerToken, verifierSession } from "@/lib/employeSession";

// Annonces en cours de l'entreprise (débutées et pas encore expirées), la plus récente d'abord.
export async function GET(request) {
  const employe = await verifierSession(getBearerToken(request));
  if (!employe) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const service = getServiceClient();
  const maintenant = new Date().toISOString();
  const { data, error } = await service
    .from("annonces")
    .select("id, contenu, debut, fin")
    .eq("entreprise_id", employe.entreprise_id)
    .lte("debut", maintenant)
    .gt("fin", maintenant)
    .order("debut", { ascending: false })
    .limit(10);

  // Table absente (SQL pas exécuté) : pas d'annonce, sans erreur visible.
  if (error) return NextResponse.json({ annonces: [] });
  return NextResponse.json({ annonces: data || [] });
}
