import { createClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/adminServer";

// Registre des systèmes affichés sur /statut. "cle" sert aussi de clé pour
// les surcharges manuelles (table statut_overrides).
export const GROUPES_STATUT = [
  {
    id: "modules",
    titre: "Modules",
    systemes: [
      { cle: "planning", nom: "Tâches", table: "taches" },
      { cle: "horaire", nom: "Horaire & Pointage", table: "pointages" },
      { cle: "inventaire", nom: "Inventaire", table: "produits_inventaire" },
      { cle: "ventes", nom: "Suivi des ventes", table: "ventes" },
      { cle: "temperature", nom: "Températures", table: "releves_temperature" },
      { cle: "commandes", nom: "Commandes", table: "commandes_en_ligne" },
    ],
  },
  {
    id: "plateforme",
    titre: "Plateforme",
    systemes: [
      { cle: "site", nom: "Le site", test: "site" },
      { cle: "dashboard", nom: "Le tableau de bord", test: "dashboard" },
    ],
  },
  {
    id: "communication",
    titre: "Communication",
    systemes: [
      { cle: "discord", nom: "Discord", statuspage: "https://discordstatus.com/api/v2/status.json" },
      { cle: "formulaire", nom: "Formulaire de contact", table: "messages_contact" },
      { cle: "courriel", nom: "Courriel", test: "courriel" },
    ],
  },
  {
    id: "externe",
    titre: "Systèmes externes",
    systemes: [
      { cle: "supabase", nom: "Supabase", statuspage: "https://status.supabase.com/api/v2/status.json" },
      { cle: "vercel", nom: "Vercel", statuspage: "https://www.vercel-status.com/api/v2/status.json" },
      { cle: "github", nom: "GitHub", statuspage: "https://www.githubstatus.com/api/v2/status.json" },
    ],
  },
];

const LENT_MS = 2500;
const TIMEOUT_MS = 6000;

async function chronometrer(fn) {
  const debut = Date.now();
  try {
    const ok = await fn();
    return { ok: !!ok, ms: Date.now() - debut };
  } catch {
    return { ok: false, ms: Date.now() - debut };
  }
}

function fetchTimeout(url, options = {}) {
  return fetch(url, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), ...options });
}

function etatDepuis({ ok, ms }) {
  if (!ok) return "panne";
  return ms > LENT_MS ? "probleme" : "ok";
}

async function verifier(systeme, ctx) {
  if (systeme.table) {
    if (!ctx.service) return { etat: "panne", ms: null };
    const r = await chronometrer(async () => {
      const { error } = await ctx.service.from(systeme.table).select("*", { head: true, count: "exact" }).limit(1);
      return !error;
    });
    return { etat: etatDepuis(r), ms: r.ms };
  }
  if (systeme.test === "site") {
    const r = await chronometrer(async () => (await fetchTimeout(`${ctx.origin}/`)).status < 400);
    return { etat: etatDepuis(r), ms: r.ms };
  }
  if (systeme.test === "dashboard") {
    // /dashboard redirige vers /login sans session : une redirection (3xx) = la page répond.
    const r = await chronometrer(async () => (await fetchTimeout(`${ctx.origin}/dashboard`)).status < 500);
    return { etat: etatDepuis(r), ms: r.ms };
  }
  if (systeme.statuspage) {
    // Page de statut publique du fournisseur (format Statuspage). Si on n'arrive pas à la lire,
    // on ne devine pas : "Problème".
    const debut = Date.now();
    try {
      const res = await fetchTimeout(systeme.statuspage, { redirect: "follow" });
      const json = await res.json();
      const indicateur = json?.status?.indicator;
      const etat = indicateur === "none" ? "ok" : indicateur === "minor" ? "probleme" : indicateur ? "panne" : "probleme";
      return { etat, ms: Date.now() - debut };
    } catch {
      return { etat: "probleme", ms: Date.now() - debut };
    }
  }
  if (systeme.test === "courriel") {
    // Les courriels (connexion, réinitialisation) passent par Supabase Auth.
    const r = await chronometrer(async () => {
      const res = await fetchTimeout(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: process.env.SUPABASE_CLE_PUBLIQUE || "" },
      });
      return res.ok;
    });
    return { etat: etatDepuis(r), ms: r.ms };
  }
  return { etat: "probleme", ms: null };
}

// Retourne { groupes: [{id, titre, systemes: [{cle, nom, etat, auto, manuel, message, ms}]}], global, verifieA }
export async function calculerStatut(origin) {
  // Client sans cache : Next.js met sinon en cache les GET de supabase-js, et les
  // surcharges de l'admin (comme l'état réel des tables) n'apparaîtraient pas.
  const service = getServiceClient()
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }) },
      })
    : null;
  const ctx = { service, origin };

  const overrides = {};
  if (service) {
    const { data } = await service.from("statut_overrides").select("cle, etat, message");
    for (const o of data || []) overrides[o.cle] = o;
  }

  const groupes = await Promise.all(
    GROUPES_STATUT.map(async (g) => ({
      id: g.id,
      titre: g.titre,
      systemes: await Promise.all(
        g.systemes.map(async (s) => {
          const auto = await verifier(s, ctx);
          const o = overrides[s.cle];
          return {
            cle: s.cle,
            nom: s.nom,
            etat: o ? o.etat : auto.etat,
            auto: auto.etat,
            manuel: !!o,
            message: o?.message || "",
            ms: auto.ms,
          };
        })
      ),
    }))
  );

  const tous = groupes.flatMap((g) => g.systemes.map((s) => s.etat));
  const global = tous.includes("panne") ? "panne" : tous.includes("probleme") ? "probleme" : "ok";
  return { groupes, global, verifieA: new Date().toISOString() };
}

export const CLES_STATUT = GROUPES_STATUT.flatMap((g) => g.systemes.map((s) => s.cle));
