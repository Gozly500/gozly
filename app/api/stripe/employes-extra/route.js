import { NextResponse } from "next/server";
import { getStripe, getSupabaseForToken, getUserProfil } from "@/lib/stripeServer";
import { BLOC, BLOCS_MAX, estCleExtra, getServiceClient, entreprisesProprietes, prixExtra } from "@/lib/employesExtraServer";

// Employés en extra (blocs de 5) sur l'abonnement du compte.
//   prix     -> { prix: { mensuel: { montant, devise } | null, annuel: ... } }   (rien si le prix Stripe n'existe pas encore)
//   etat     -> les entreprises du compte avec leur limite, leurs extras et le prix du bloc
//   modifier -> { entrepriseId, blocs } : nouveau nombre de blocs de CETTE entreprise ; met à jour Gozly puis la ligne Stripe

function resumePrix(p) {
  return p ? { montant: p.unit_amount != null ? p.unit_amount / 100 : null, devise: (p.currency || "").toUpperCase() } : null;
}

export async function POST(request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "L'abonnement Stripe n'est pas encore configuré." }, { status: 501 });

  const corps = await request.json().catch(() => ({}));

  if (corps.action === "prix") {
    const [m, a] = await Promise.all([prixExtra(stripe, "mensuel"), prixExtra(stripe, "annuel")]);
    return NextResponse.json({ prix: { mensuel: resumePrix(m), annuel: resumePrix(a) } });
  }

  const token = (request.headers.get("authorization") || "").replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const supabase = getSupabaseForToken(token);
  const { user, profil } = await getUserProfil(supabase, token);
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  if (!profil) return NextResponse.json({ error: "Profil introuvable." }, { status: 400 });

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  // Limite d'employés du forfait du compte (null = illimité).
  let base = null;
  if (profil.forfait) {
    const { data: f } = await service.from("forfaits").select("limite_employes").eq("id", profil.forfait).maybeSingle();
    base = f?.limite_employes ?? null;
  }

  if (corps.action === "etat") {
    if (!profil.stripe_subscription_id || base === null) return NextResponse.json({ disponible: false });
    const entreprises = await entreprisesProprietes(service, profil.id);
    const lignes = [];
    for (const e of entreprises) {
      const { count } = await service.from("employes").select("id", { count: "exact", head: true }).eq("entreprise_id", e.id);
      lignes.push({ id: e.id, nom: e.nom, extra: Math.round((e.employes_extra || 0) / BLOC), employes: count || 0 });
    }
    let periode = "mensuel";
    try {
      const sub = await stripe.subscriptions.retrieve(profil.stripe_subscription_id, { expand: ["items.data.price"] });
      const plan = sub.items.data.find((i) => !estCleExtra(i.price?.lookup_key)) || sub.items.data[0];
      if (plan?.price?.recurring?.interval === "year") periode = "annuel";
    } catch {}
    const prix = resumePrix(await prixExtra(stripe, periode));
    if (!prix) return NextResponse.json({ disponible: false });
    return NextResponse.json({ disponible: true, base, bloc: BLOC, periode, prix, entreprises: lignes });
  }

  if (corps.action === "modifier") {
    const blocs = Number(corps.blocs);
    if (!Number.isInteger(blocs) || blocs < 0 || blocs > BLOCS_MAX) return NextResponse.json({ error: "Nombre de blocs invalide." }, { status: 400 });
    if (!profil.stripe_subscription_id) return NextResponse.json({ error: "Abonne-toi à un forfait avant d'ajouter des employés." }, { status: 400 });
    if (base === null) return NextResponse.json({ error: "Ton forfait n'a pas de limite d'employés." }, { status: 400 });

    const entreprises = await entreprisesProprietes(service, profil.id);
    const cible = entreprises.find((e) => e.id === corps.entrepriseId);
    if (!cible) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
    const ancien = cible.employes_extra || 0;
    const autres = entreprises.filter((e) => e.id !== cible.id).reduce((n, e) => n + (e.employes_extra || 0), 0);
    const totalBlocs = Math.round(autres / BLOC) + blocs;

    try {
      const sub = await stripe.subscriptions.retrieve(profil.stripe_subscription_id, { expand: ["items.data.price"] });
      const plan = sub.items.data.find((i) => !estCleExtra(i.price?.lookup_key)) || sub.items.data[0];
      const ligneExtra = sub.items.data.find((i) => estCleExtra(i.price?.lookup_key));
      const periode = plan?.price?.recurring?.interval === "year" ? "annuel" : "mensuel";

      let prix = null;
      if (totalBlocs > 0 && !ligneExtra) {
        prix = await prixExtra(stripe, periode);
        if (!prix) return NextResponse.json({ error: "Les employés supplémentaires ne sont pas disponibles pour le moment." }, { status: 404 });
      }

      // Gozly d'abord (pour que le webhook trouve déjà le bon total), puis Stripe ; on annule si Stripe refuse.
      const { error: erreurBase } = await service.from("entreprises").update({ employes_extra: blocs * BLOC }).eq("id", cible.id);
      if (erreurBase) {
        console.error("Mise à jour des employés en extra:", erreurBase.message);
        return NextResponse.json({ error: "Impossible de modifier pour le moment." }, { status: 500 });
      }
      try {
        if (totalBlocs === 0 && ligneExtra) {
          await stripe.subscriptionItems.del(ligneExtra.id, { proration_behavior: "create_prorations" });
        } else if (totalBlocs > 0 && ligneExtra) {
          await stripe.subscriptionItems.update(ligneExtra.id, { quantity: totalBlocs, proration_behavior: "create_prorations" });
        } else if (totalBlocs > 0) {
          await stripe.subscriptionItems.create({ subscription: sub.id, price: prix.id, quantity: totalBlocs, proration_behavior: "create_prorations" });
        }
      } catch (err) {
        await service.from("entreprises").update({ employes_extra: ancien }).eq("id", cible.id);
        throw err;
      }
      return NextResponse.json({ ok: true, blocs });
    } catch (err) {
      console.error("Employés en extra, erreur Stripe:", err);
      return NextResponse.json({ error: "Impossible de modifier ton abonnement pour le moment." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}
