import { createClient } from "@supabase/supabase-js";

// Employés en extra : blocs de 5 qui s'ajoutent à la limite d'employés du forfait (voir supabase/employes_extra.sql).
// Deux sources séparées : `employes_extra` = offerts par l'admin (jamais touchés par Stripe) ; `employes_extra_achetes` = facturés
// par Stripe (supabase/employes_extra_achetes.sql). La limite = forfait + offerts + achetés.
// Côté Stripe, c'est UNE ligne de plus sur le même abonnement du compte (une seule facture), dont la quantité = nombre de blocs
// au total pour toutes les entreprises du compte. Côté Gozly, chaque entreprise garde son propre nombre d'extras achetés.
export const BLOC = 5;
export const BLOCS_MAX = 40;
export const CLE_EXTRA = { mensuel: "employe_extra", annuel: "employe_extra_annuel" };
const TOUTES = Object.values(CLE_EXTRA);

export function estCleExtra(cle) {
  return TOUTES.includes(cle);
}

export function getServiceClient() {
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cle) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, cle);
}

// Les entreprises dont ce compte est propriétaire, de la plus ancienne à la plus récente.
export async function entreprisesProprietes(service, profilId) {
  const { data: membres } = await service.from("membres").select("entreprise_id").eq("user_id", profilId).eq("role", "proprietaire");
  const ids = (membres || []).map((m) => m.entreprise_id);
  if (ids.length === 0) return [];
  const { data } = await service.from("entreprises").select("id, nom, employes_extra, employes_extra_achetes, created_at").in("id", ids).order("created_at");
  return data || [];
}

// Le prix Stripe actif de l'extra pour une période ("mensuel" | "annuel"), ou null s'il n'est pas (encore) créé.
export async function prixExtra(stripe, periode) {
  const cle = CLE_EXTRA[periode === "annuel" ? "annuel" : "mensuel"];
  try {
    const { data } = await stripe.prices.list({ lookup_keys: [cle], active: true, limit: 1 });
    return data[0] || null;
  } catch (err) {
    console.error("Lecture du prix des employés en extra:", err.message);
    return null;
  }
}

// Aligne les extras ACHETÉS des entreprises du compte sur le nombre de blocs facturé par Stripe (les offerts ne sont jamais touchés). L'écart s'ajoute à la plus ancienne
// entreprise, ou se retire en commençant par la plus récente.
export async function reconcilier(service, profilId, blocs) {
  const entreprises = await entreprisesProprietes(service, profilId);
  if (entreprises.length === 0) return;
  const cible = Math.max(0, Math.round(blocs)) * BLOC;
  let ecart = cible - entreprises.reduce((n, e) => n + (e.employes_extra_achetes || 0), 0);
  if (ecart === 0) return;

  if (ecart > 0) {
    const premiere = entreprises[0];
    await service.from("entreprises").update({ employes_extra_achetes: (premiere.employes_extra_achetes || 0) + ecart }).eq("id", premiere.id);
    return;
  }
  for (const e of [...entreprises].reverse()) {
    if (ecart === 0) break;
    const retire = Math.min(e.employes_extra_achetes || 0, -ecart);
    if (retire > 0) {
      await service.from("entreprises").update({ employes_extra_achetes: (e.employes_extra_achetes || 0) - retire }).eq("id", e.id);
      ecart += retire;
    }
  }
}
