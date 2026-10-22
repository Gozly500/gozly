import { NextResponse } from "next/server";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";
import { getStripe } from "@/lib/stripeServer";

// Taxes (TPS/TVQ): quand les « taux de taxe » existent dans Stripe, mettre leurs identifiants
// (txr_...) séparés par des virgules dans la variable Vercel STRIPE_TAX_RATE_IDS. Tant qu'elle est
// vide, les factures sont envoyées sans taxes.
function tauxDeTaxe() {
  return (process.env.STRIPE_TAX_RATE_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function trouverOuCreerClientStripe(stripe, service, profilId) {
  const { data: profil } = await service.from("profils").select("*").eq("id", profilId).maybeSingle();
  if (!profil) return { erreur: "Profil introuvable." };

  const { data: usager } = await service.auth.admin.getUserById(profilId);
  const courriel = usager?.user?.email;
  if (!courriel) return { erreur: "Ce compte n'a pas de courriel." };

  if (profil.stripe_customer_id) return { customerId: profil.stripe_customer_id, courriel };

  const client = await stripe.customers.create({
    email: courriel,
    name: profil.full_name || courriel,
    metadata: { user_id: profilId },
  });
  await service.from("profils").update({ stripe_customer_id: client.id }).eq("id", profilId);
  return { customerId: client.id, courriel };
}

export async function GET(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const stripe = getStripe();
  const service = getServiceClient();
  if (!stripe || !service) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  const profilId = new URL(request.url).searchParams.get("profilId");
  if (!profilId) return NextResponse.json({ error: "profilId manquant." }, { status: 400 });

  const { data: profil } = await service.from("profils").select("stripe_customer_id").eq("id", profilId).maybeSingle();
  if (!profil?.stripe_customer_id) return NextResponse.json({ factures: [] });

  const liste = await stripe.invoices.list({ customer: profil.stripe_customer_id, limit: 10 });
  const factures = liste.data
    // Les factures d'abonnement (forfaits) ne sont pas listées ici, seulement celles créées à la main.
    .filter((f) => f.metadata?.source === "admin")
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
}

export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const stripe = getStripe();
  const service = getServiceClient();
  if (!stripe || !service) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const { profilId, lignes, joursEcheance, note } = body;
  if (!profilId) return NextResponse.json({ error: "profilId manquant." }, { status: 400 });

  const lignesValides = (Array.isArray(lignes) ? lignes : [])
    .map((l) => ({
      description: String(l.description || "").trim().slice(0, 500),
      quantite: Math.round(Number(l.quantite)),
      prixCents: Math.round(Number(l.prix) * 100),
    }))
    .filter((l) => l.description);
  if (lignesValides.length === 0) return NextResponse.json({ error: "Ajoute au moins une ligne avec une description." }, { status: 400 });
  if (lignesValides.some((l) => !(l.quantite >= 1) || !Number.isFinite(l.prixCents) || l.prixCents <= 0)) {
    return NextResponse.json({ error: "Chaque ligne doit avoir une quantité d'au moins 1 et un prix plus grand que 0." }, { status: 400 });
  }
  const jours = Math.min(120, Math.max(1, Math.round(Number(joursEcheance)) || 30));

  let brouillonId = null;
  try {
    const { customerId, courriel, erreur } = await trouverOuCreerClientStripe(stripe, service, profilId);
    if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });

    const taxes = tauxDeTaxe();
    const brouillon = await stripe.invoices.create({
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: jours,
      currency: "cad",
      description: String(note || "").trim().slice(0, 1000) || undefined,
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      ...(taxes.length ? { default_tax_rates: taxes } : {}),
      metadata: { source: "admin" },
    });

    brouillonId = brouillon.id;
    for (const l of lignesValides) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: brouillon.id,
        description: l.description,
        quantity: l.quantite,
        unit_amount_decimal: String(l.prixCents),
        currency: "cad",
      });
    }

    await stripe.invoices.finalizeInvoice(brouillon.id);
    const envoyee = await stripe.invoices.sendInvoice(brouillon.id);

    return NextResponse.json({ success: true, courriel, url: envoyee.hosted_invoice_url, numero: envoyee.number, taxes: taxes.length > 0 });
  } catch (e) {
    // Ne laisse pas un brouillon à moitié rempli chez Stripe (impossible une fois la facture finalisée).
    if (brouillonId) await stripe.invoices.del(brouillonId).catch(() => {});
    return NextResponse.json({ error: "Stripe a refusé la facture : " + (e?.message || "erreur inconnue") }, { status: 500 });
  }
}
