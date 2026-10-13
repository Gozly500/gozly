import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { envoyerPushEmployes } from "@/lib/pushServer";

// Durées permises (en heures) : 24 h, 3 jours, 1 semaine, 2 semaines, 1 mois.
const DUREES_HEURES = [24, 72, 168, 336, 720];

// Publie une annonce (dashboard > Discussion > + Nouveau > Annonce) et prévient les employés par notification.
export async function POST(request) {
  const { entrepriseId, contenu, dureeHeures } = await request.json().catch(() => ({}));

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const supabase = getSupabaseForToken(token);
  const { user, entreprise } = await getUserEntrepriseParId(supabase, token, entrepriseId);
  if (!user || !entreprise) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const texte = typeof contenu === "string" ? contenu.trim().slice(0, 600) : "";
  if (!texte) {
    return NextResponse.json({ error: "Écris le texte de l'annonce." }, { status: 400 });
  }
  if (!DUREES_HEURES.includes(Number(dureeHeures))) {
    return NextResponse.json({ error: "Durée invalide." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Configuration manquante." }, { status: 500 });
  }

  const debut = new Date();
  const fin = new Date(debut.getTime() + Number(dureeHeures) * 3600 * 1000);

  const { data: annonce, error } = await service
    .from("annonces")
    .insert({ entreprise_id: entreprise.id, contenu: texte, debut: debut.toISOString(), fin: fin.toISOString(), cree_par: user.id })
    .select("*")
    .single();

  if (error) {
    console.error("Erreur publication d'une annonce:", error.message);
    return NextResponse.json({ error: "La publication a échoué (le fichier SQL annonces.sql est-il exécuté ?)." }, { status: 500 });
  }

  // Notification à tous les employés de l'entreprise (échoue en silence : l'annonce est publiée dans tous les cas).
  const { data: employes } = await service.from("employes").select("id").eq("entreprise_id", entreprise.id);
  await envoyerPushEmployes(service, (employes || []).map((e) => e.id), {
    titre: "Annonce",
    corps: texte.length > 140 ? `${texte.slice(0, 137)}...` : texte,
    url: "/moi/accueil",
  }).catch((err) => console.error("Erreur notification d'annonce:", err));

  return NextResponse.json({ annonce });
}
