import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken } from "@/lib/stripeServer";
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
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

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

  if (!conversation) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  // L'entreprise de LA conversation elle-même fait foi (pas besoin que le
  // client la précise) - on vérifie seulement que l'appelant en est bien
  // membre, via le client authentifié comme lui (RLS "un utilisateur peut
  // lire sa propre entreprise" = est_membre(id)).
  const { data: appartenance } = await supabase
    .from("entreprises")
    .select("id")
    .eq("id", conversation.entreprise_id)
    .maybeSingle();
  if (!appartenance) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  await notifierNouveauMessage(service, {
    conversationId,
    expediteurNom: "Administration",
    contenu: contenu.trim(),
  }).catch((err) => console.error("Erreur notification push:", err));

  return NextResponse.json({ ok: true });
}
