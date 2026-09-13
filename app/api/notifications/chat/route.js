import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken, getUserEntreprise } from "@/lib/stripeServer";
import { notifierNouveauMessage } from "@/lib/pushServer";

// Déclenché par DiscussionSection.jsx (dashboard) juste après l'insertion
// d'un message - l'insertion elle-même se fait client-side via RLS
// (authenticated), mais l'envoi du push a besoin de web-push (Node) et des
// clés VAPID, donc doit passer par une route serveur.
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntreprise(supabase, token);
  if (!user || !entreprise) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { conversationId, contenu } = await request.json().catch(() => ({}));
  if (!conversationId || !contenu?.trim()) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const service = getServiceClient();
  const { data: conversation } = await service
    .from("conversations")
    .select("entreprise_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation || conversation.entreprise_id !== entreprise.id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  await notifierNouveauMessage(service, {
    conversationId,
    expediteurNom: "Administration",
    contenu: contenu.trim(),
  }).catch((err) => console.error("Erreur notification push:", err));

  return NextResponse.json({ ok: true });
}
