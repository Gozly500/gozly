import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";

// Nettoyage quotidien de la communication (Vercel Cron, voir vercel.json) : supprime, 30 jours après leur expiration,
//  - les annonces (leurs accusés de lecture partent avec, en cascade) ;
//  - les rappels (leurs destinataires aussi) ;
//  - les appels de remplaçant (comme leur quart est passé, ils n'ont plus de raison d'être).
// Les 30 jours laissent le temps au propriétaire de consulter « qui a lu » après la fin d'une annonce.

const DELAI_JOURS = 30;

export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  // Sans CRON_SECRET configuré, refuser tout : sinon "Bearer undefined" passerait.
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  }

  const seuil = new Date(Date.now() - DELAI_JOURS * 24 * 3600 * 1000).toISOString();
  const resultat = {};

  // Une table absente (SQL pas encore exécuté) n'est pas une erreur : on la saute.
  async function nettoyer(nom, table, colonne) {
    const { data, error } = await service.from(table).delete().lt(colonne, seuil).select("id");
    resultat[nom] = error ? "ignoré" : (data || []).length;
  }

  await nettoyer("annonces", "annonces", "fin");
  await nettoyer("rappels", "rappels", "fin");
  await nettoyer("appelsRemplacant", "appels_remplacant", "created_at");

  return NextResponse.json({ ok: true, supprimes: resultat });
}
