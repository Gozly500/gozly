import crypto from "crypto";

// Clés d'API des apps de développeurs (une par app). Seul le hash est gardé en base ; la clé complète s'affiche une seule fois.
export const PREFIXE_CLE_APP = "gozly_app_";

export function hashCleApp(cle) {
  return crypto.createHash("sha256").update(cle).digest("hex");
}

export function genererCleApp() {
  const cle = PREFIXE_CLE_APP + crypto.randomBytes(24).toString("base64url");
  return { cle, hash: hashCleApp(cle), prefixe: cle.slice(0, PREFIXE_CLE_APP.length + 6) };
}

// Limites du palier gratuit (compte sans forfait). Les forfaits ont les leurs dans la table forfaits (api_limite_*, limite_apps),
// voir supabase/apps_limites_forfait.sql.
export const LIMITES_PAR_DEFAUT = { limite_min_entreprise: 30, limite_min_app: 120, limite_jour: 5000 };

// Limites réelles d'une app : sa propre valeur si l'admin en a fixé une (colonne non nulle), sinon celle du forfait de son
// développeur, sinon celles du palier gratuit. Un petit cache (60 s) évite de relire le forfait à chaque appel.
const cacheForfaits = new Map();
export async function limitesPourApp(service, app) {
  let tier = null;
  let forfaitId = null;
  if (app.proprietaire_id) {
    const cle = app.proprietaire_id;
    const memo = cacheForfaits.get(cle);
    if (memo && Date.now() - memo.t < 60_000) {
      tier = memo.tier;
      forfaitId = memo.forfaitId;
    } else {
      try {
        const { data: profil } = await service.from("profils").select("forfait").eq("id", cle).maybeSingle();
        forfaitId = profil?.forfait || null;
        if (forfaitId) {
          const { data: f } = await service.from("forfaits").select("*").eq("id", forfaitId).maybeSingle();
          tier = f || null;
        }
      } catch {}
      cacheForfaits.set(cle, { t: Date.now(), tier, forfaitId });
    }
  }
  return {
    forfait: forfaitId,
    limite_min_entreprise: app.limite_min_entreprise ?? tier?.api_limite_min_entreprise ?? LIMITES_PAR_DEFAUT.limite_min_entreprise,
    limite_min_app: app.limite_min_app ?? tier?.api_limite_min_app ?? LIMITES_PAR_DEFAUT.limite_min_app,
    limite_jour: app.limite_jour ?? tier?.api_limite_jour ?? LIMITES_PAR_DEFAUT.limite_jour,
  };
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Vérifie un appel d'app : clé valide, app approuvée et non suspendue, entreprise qui l'a installée, puis les limites.
// Retourne { app, entrepriseId } ou { erreur: { status, message, retry } }.
export async function verifierAppelApp(service, request) {
  const jeton = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const entrepriseId = (request.headers.get("x-gozly-entreprise") || "").trim();
  if (!jeton.startsWith(PREFIXE_CLE_APP)) return { erreur: { status: 401, message: "Clé d'accès manquante ou invalide." } };
  if (!RE_UUID.test(entrepriseId)) return { erreur: { status: 400, message: "L'en-tête X-Gozly-Entreprise est requis." } };

  const { data: app } = await service.from("apps_developpeur").select("*").eq("cle_api_hash", hashCleApp(jeton)).maybeSingle();
  if (!app) return { erreur: { status: 401, message: "Clé d'accès manquante ou invalide." } };
  if (app.suspendue) return { erreur: { status: 403, message: "Cette app est suspendue. Écris au support de Gozly." } };
  if (app.statut !== "approuvee") return { erreur: { status: 403, message: "Cette app n'est pas approuvée." } };

  const { data: installee } = await service
    .from("integrations_installees")
    .select("entreprise_id")
    .eq("entreprise_id", entrepriseId)
    .eq("integration_id", `app:${app.id}`)
    .maybeSingle();
  if (!installee) return { erreur: { status: 403, message: "Cette entreprise n'a pas installé l'app." } };

  const lim = await limitesPourApp(service, app);
  const { data: verdict } = await service.rpc("compter_appel_app", {
    p_app: app.id,
    p_ent: entrepriseId,
    p_lim_min_ent: lim.limite_min_entreprise,
    p_lim_min_app: lim.limite_min_app,
    p_lim_jour: lim.limite_jour,
  });
  if (verdict === "suspendue") return { erreur: { status: 403, message: "Cette app a été suspendue : trop de requêtes." } };
  if (verdict === "minute_entreprise" || verdict === "minute_app") return { erreur: { status: 429, message: "Trop de requêtes : réessaie dans une minute.", retry: 60 } };
  if (verdict === "jour") return { erreur: { status: 429, message: "Limite quotidienne atteinte : réessaie demain.", retry: 3600 } };
  return { app, entrepriseId };
}
