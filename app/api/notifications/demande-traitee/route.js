import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/adminServer";
import { getSupabaseForToken, getUserEntreprise } from "@/lib/stripeServer";
import { envoyerPushEmployes } from "@/lib/pushServer";

// Déclenché par DemandesSection.jsx (dashboard) juste après avoir
// approuvé/refusé un congé ou un échange - la mise à jour elle-même se
// fait client-side via RLS, mais l'envoi du push a besoin de web-push
// (Node), donc doit passer par une route serveur (même raison que
// /api/notifications/chat).
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntreprise(supabase, token);
  if (!user || !entreprise) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { type, employeId, approuve } = await request.json().catch(() => ({}));
  if (!["conge", "echange"].includes(type) || !employeId || typeof approuve !== "boolean") {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const service = getServiceClient();

  const { data: cible } = await service
    .from("employes")
    .select("id, entreprise_id")
    .eq("id", employeId)
    .maybeSingle();
  if (!cible || cible.entreprise_id !== entreprise.id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const titre = type === "conge" ? "Demande de congé" : "Échange de quart";
  const corps =
    type === "conge"
      ? approuve
        ? "Ta demande de congé a été approuvée."
        : "Ta demande de congé a été refusée."
      : approuve
        ? "Ton échange de quart a été approuvé."
        : "Ton échange de quart a été refusé.";
  const typeNotif = type === "conge" ? "notif_conge_traite" : "notif_echange_traite";

  await envoyerPushEmployes(service, [employeId], { titre, corps, url: "/moi/demandes" }, typeNotif).catch((err) =>
    console.error("Erreur notification push:", err)
  );

  return NextResponse.json({ ok: true });
}
