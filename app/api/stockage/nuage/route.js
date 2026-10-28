import { NextResponse } from "next/server";
import { getSupabaseForToken } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";
import { FOURNISSEURS } from "@/lib/exportsStockage";

// Où un logiciel de la suite (Textas, Calky) peut enregistrer : les entreprises de l'utilisateur qui ont un
// OneDrive ou un Google Drive connecté dans Paramètres > Intégrations. Jamais de jeton dans la réponse.
export async function GET(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const supabase = getSupabaseForToken(token);
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Le stockage en ligne n'est pas encore configuré." }, { status: 501 });

  // Le client authentifié comme l'utilisateur ne voit que ses propres entreprises (règles RLS)
  const { data: entreprises } = await supabase.from("entreprises").select("id, nom");
  const ids = (entreprises || []).map((e) => e.id);
  if (ids.length === 0) return NextResponse.json({ destinations: [] });

  const { data: connexions } = await service
    .from("stockage_connexions")
    .select("entreprise_id, fournisseur, compte_email")
    .in("entreprise_id", ids)
    .eq("statut", "connecte");

  const destinations = (connexions || [])
    .filter((c) => FOURNISSEURS[c.fournisseur])
    .map((c) => ({
      entrepriseId: c.entreprise_id,
      entrepriseNom: entreprises.find((e) => e.id === c.entreprise_id)?.nom || "",
      fournisseur: c.fournisseur,
      nomFournisseur: FOURNISSEURS[c.fournisseur].nom,
      email: c.compte_email || "",
    }));

  return NextResponse.json({ destinations });
}
