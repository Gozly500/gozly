import { NextResponse } from "next/server";
import { getStripe, getSupabaseForToken, getUserProfil } from "@/lib/stripeServer";

// Factures sur mesure (créées par un admin) du compte connecté. Le client Stripe est lu depuis le profil
// de l'utilisateur lui-même (session + RLS) : impossible de lire les factures d'un autre compte.
export async function GET(request) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ factures: [] });

  const supabase = getSupabaseForToken(token);
  const { user, profil } = await getUserProfil(supabase, token);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!profil?.stripe_customer_id) return NextResponse.json({ factures: [] });

  try {
    const liste = await stripe.invoices.list({ customer: profil.stripe_customer_id, limit: 20 });
    const factures = liste.data
      .filter((f) => f.metadata?.source === "admin" && (f.status === "open" || f.status === "paid"))
      .map((f) => ({
        id: f.id,
        numero: f.number,
        statut: f.status,
        total: f.total,
        creee: f.created,
        echeance: f.due_date,
        url: f.hosted_invoice_url,
      }));
    return NextResponse.json({ factures });
  } catch (err) {
    console.error("Stripe invoices list error:", err);
    return NextResponse.json({ error: "Impossible de charger les factures." }, { status: 500 });
  }
}
