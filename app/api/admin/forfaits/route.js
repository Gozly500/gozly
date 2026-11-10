import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin, getServiceClient } from "@/lib/adminServer";
import { getStripe } from "@/lib/stripeServer";

// Abonnements (panneau admin) : forfaits, limites et clés de recherche Stripe. Tout passe par ici (clé service_role) :
// les clients connectés peuvent LIRE les forfaits mais pas les écrire (voir supabase/forfaits_gerables.sql).
//   lister            -> { forfaits, cles, comptes: { forfait: nb }, prixStripe: { cle: { ... } } }
//   enregistrer       -> crée ou modifie un forfait
//   supprimer         -> seulement si aucun compte ne l'utilise
//   ajouterCle        -> associe une clé de recherche Stripe à un forfait
//   retirerCle        -> retire une clé
//   creerPersonnalise -> crée un forfait pour UN compte et le lui assigne

const MESSAGE_SQL_AVANTAGES = "Les nouveaux avantages ne sont pas encore installés : exécute supabase/forfaits_avantages.sql dans Supabase (SQL Editor).";
const MESSAGE_SQL = "La table des forfaits est absente : exécute supabase/forfaits_gerables.sql dans Supabase (SQL Editor).";

function entierOuNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : undefined; // undefined = invalide
}

const MODULES_VALIDES = ["planning", "horaire", "inventaire", "ventes", "temperature", "commandes", "musique"];

// Avantages d'un forfait reçus du formulaire : limites (vide = illimité) et modules autorisés (vide/absent = tous).
function avantages(corps) {
  const limiteModules = entierOuNull(corps.limite_modules);
  const limiteEntreprises = entierOuNull(corps.limite_entreprises);
  const limiteEmployes = entierOuNull(corps.limite_employes);
  if (limiteModules === undefined || limiteEntreprises === undefined || limiteEmployes === undefined) {
    return { erreur: "Les limites doivent être des nombres entiers (ou vides pour illimité)." };
  }
  let modulesAutorises = null;
  if (Array.isArray(corps.modules_autorises)) {
    modulesAutorises = corps.modules_autorises.filter((m) => MODULES_VALIDES.includes(m));
    if (modulesAutorises.length === MODULES_VALIDES.length) modulesAutorises = null; // tous cochés = aucune restriction
  }
  return {
    champs: { limite_modules: limiteModules, limite_entreprises: limiteEntreprises, limite_employes: limiteEmployes, modules_autorises: modulesAutorises },
  };
}

// Numéro de forfait au hasard, ex: GZ-482913.
function numeroAleatoire() {
  return "GZ-" + String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
}

function colonneAbsente(error) {
  return /column|numero|limite_employes|modules_autorises/i.test(error?.message || "") && /exist|schema cache|find/i.test(error?.message || "");
}

function slug(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

// Les prix Stripe qui portent ces clés (max 10 clés par appel Stripe) : montant, période, actif. Rien si Stripe n'est pas configuré.
async function prixStripeDesCles(cles) {
  const stripe = getStripe();
  const resultat = {};
  if (!stripe || cles.length === 0) return resultat;
  for (let i = 0; i < cles.length; i += 10) {
    try {
      const { data } = await stripe.prices.list({ lookup_keys: cles.slice(i, i + 10), limit: 100 });
      for (const p of data) {
        resultat[p.lookup_key] = {
          montant: p.unit_amount != null ? p.unit_amount / 100 : null,
          devise: (p.currency || "").toUpperCase(),
          intervalle: p.recurring?.interval || null,
          actif: p.active,
        };
      }
    } catch (err) {
      console.error("Lecture des prix Stripe:", err.message);
    }
  }
  return resultat;
}

export async function POST(request) {
  const { errorStatus, errorMessage } = await requireAdmin(request);
  if (errorStatus) return NextResponse.json({ error: errorMessage }, { status: errorStatus });

  const service = getServiceClient();
  if (!service) return NextResponse.json({ error: "Configuration serveur incomplète." }, { status: 500 });

  const corps = await request.json().catch(() => ({}));
  const { action } = corps;

  if (action === "lister") {
    const [{ data: forfaits, error }, { data: cles }, { data: profils }] = await Promise.all([
      service.from("forfaits").select("*").order("ordre").order("label"),
      service.from("forfaits_cles").select("*").order("cle"),
      service.from("profils").select("forfait"),
    ]);
    if (error) return NextResponse.json({ error: MESSAGE_SQL, detail: error.message }, { status: 500 });
    const comptes = {};
    for (const p of profils || []) if (p.forfait) comptes[p.forfait] = (comptes[p.forfait] || 0) + 1;
    const prixStripe = await prixStripeDesCles((cles || []).map((c) => c.cle));
    return NextResponse.json({ forfaits, cles: cles || [], comptes, prixStripe });
  }

  if (action === "enregistrer") {
    const label = String(corps.label || "").trim();
    const av = avantages(corps);
    if (!label) return NextResponse.json({ error: "Donne un nom au forfait." }, { status: 400 });
    if (av.erreur) return NextResponse.json({ error: av.erreur }, { status: 400 });
    const champs = {
      label,
      ...av.champs,
      publique: !!corps.publique,
      actif: corps.actif !== false,
      ordre: Number.isInteger(corps.ordre) ? corps.ordre : 100,
    };
    if (corps.id) {
      const { error } = await service.from("forfaits").update(champs).eq("id", corps.id);
      if (error && colonneAbsente(error)) return NextResponse.json({ error: MESSAGE_SQL_AVANTAGES }, { status: 500 });
      if (error) return NextResponse.json({ error: "Enregistrement impossible : " + error.message }, { status: 500 });
      return NextResponse.json({ ok: true, id: corps.id });
    }
    const id = slug(label) || "forfait-" + randomBytes(3).toString("hex");
    const { error } = await service.from("forfaits").insert({ id, numero: numeroAleatoire(), ...champs });
    if (error && colonneAbsente(error)) return NextResponse.json({ error: MESSAGE_SQL_AVANTAGES }, { status: 500 });
    if (error) {
      const existe = /duplicate|unique/i.test(error.message);
      return NextResponse.json({ error: existe ? `Un forfait « ${id} » existe déjà : change le nom.` : "Création impossible : " + error.message }, { status: existe ? 409 : 500 });
    }
    return NextResponse.json({ ok: true, id });
  }

  if (action === "supprimer") {
    const { id } = corps;
    if (!id) return NextResponse.json({ error: "Forfait manquant." }, { status: 400 });
    const { count } = await service.from("profils").select("id", { count: "exact", head: true }).eq("forfait", id);
    if (count > 0) {
      return NextResponse.json({ error: `${count} compte(s) utilisent ce forfait : change leur forfait d'abord (ou désactive-le au lieu de le supprimer).` }, { status: 409 });
    }
    const { error } = await service.from("forfaits").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Suppression impossible : " + error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "ajouterCle") {
    const cle = String(corps.cle || "").trim();
    const periode = corps.periode === "annuel" ? "annuel" : "mensuel";
    if (!cle || !corps.forfait_id) return NextResponse.json({ error: "Clé ou forfait manquant." }, { status: 400 });
    if (!/^[a-zA-Z0-9_\-.]+$/.test(cle)) return NextResponse.json({ error: "La clé ne doit contenir que des lettres, chiffres, _ - ou ." }, { status: 400 });
    const { error } = await service.from("forfaits_cles").insert({ cle, forfait_id: corps.forfait_id, periode });
    if (error) {
      const existe = /duplicate|unique/i.test(error.message);
      return NextResponse.json({ error: existe ? "Cette clé est déjà associée à un forfait." : "Ajout impossible : " + error.message }, { status: existe ? 409 : 500 });
    }
    const prix = (await prixStripeDesCles([cle]))[cle] || null;
    return NextResponse.json({ ok: true, prixStripe: prix, avertissement: prix ? null : "Aucun prix Stripe n'a cette clé pour le moment (vérifie l'orthographe dans Stripe)." });
  }

  if (action === "retirerCle") {
    if (!corps.cle) return NextResponse.json({ error: "Clé manquante." }, { status: 400 });
    const { error } = await service.from("forfaits_cles").delete().eq("cle", corps.cle);
    if (error) return NextResponse.json({ error: "Retrait impossible : " + error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "creerPersonnalise") {
    const label = String(corps.label || "").trim();
    const av = avantages(corps);
    if (!label) return NextResponse.json({ error: "Donne un nom au forfait." }, { status: 400 });
    if (av.erreur) return NextResponse.json({ error: av.erreur }, { status: 400 });
    const id = `perso-${slug(label) || "client"}-${randomBytes(2).toString("hex")}`;
    const { error } = await service.from("forfaits").insert({
      id,
      label,
      numero: numeroAleatoire(),
      ...av.champs,
      publique: false,
      personnalise: true,
      actif: true,
      ordre: 200,
    });
    if (error && colonneAbsente(error)) return NextResponse.json({ error: MESSAGE_SQL_AVANTAGES }, { status: 500 });
    if (error) return NextResponse.json({ error: error.message.includes("relation") ? MESSAGE_SQL : "Création impossible : " + error.message }, { status: 500 });
    if (!corps.profilId) return NextResponse.json({ ok: true, id }); // créé sans l'assigner : à assigner plus tard
    // Le forfait du compte se propage ensuite aux entreprises qu'il possède (déclencheur forfait_par_compte.sql).
    const { error: erreurAssign } = await service.from("profils").update({ forfait: id }).eq("id", corps.profilId);
    if (erreurAssign) return NextResponse.json({ error: "Forfait créé mais non assigné : " + erreurAssign.message }, { status: 500 });
    return NextResponse.json({ ok: true, id });
  }

  return NextResponse.json({ error: "Action invalide." }, { status: 400 });
}
