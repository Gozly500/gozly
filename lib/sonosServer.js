import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseForToken, getUserEntrepriseParId } from "@/lib/stripeServer";
import { getServiceClient } from "@/lib/adminServer";

// Module « Musique » : contrôle du système Sonos d'une entreprise via l'API Sonos (nuage).
// Liaison OAuth 2.0 (SONOS_CLIENT_ID / SONOS_CLIENT_SECRET, voir supabase/sonos.sql pour les jetons stockés).
// Les adresses peuvent être remplacées (SONOS_API_BASE, SONOS_TOKEN_URL) pour tester avec un faux Sonos.
const AUTORISER = "https://api.sonos.com/login/v3/oauth";
const API = () => process.env.SONOS_API_BASE || "https://api.ws.sonos.com/control/api/v1";
const URL_JETON = () => process.env.SONOS_TOKEN_URL || `${AUTORISER}/access`;
const DUREE_STATE_MS = 15 * 60 * 1000;
const MARGE_RAFRAICHISSEMENT_MS = 5 * 60 * 1000;

export function configSonos() {
  const clientId = (process.env.SONOS_CLIENT_ID || "").trim();
  const secret = (process.env.SONOS_CLIENT_SECRET || "").trim();
  return clientId && secret ? { clientId, secret } : null;
}

export function adresseRetour(request) {
  return (process.env.SONOS_REDIRECT_URI || "").trim() || `${new URL(request.url).origin}/api/sonos/callback`;
}

// « state » signé : prouve, au retour de Sonos, quelle entreprise a lancé la liaison (sans session sur cette requête).
function signer(corps, secret) {
  return crypto.createHmac("sha256", crypto.createHash("sha256").update("sonos-state:" + secret).digest()).update(corps).digest("base64url");
}

export function creerState(entrepriseId, userId) {
  const cfg = configSonos();
  const corps = Buffer.from(JSON.stringify({ e: entrepriseId, u: userId, x: Date.now() + DUREE_STATE_MS })).toString("base64url");
  return `${corps}.${signer(corps, cfg.secret)}`;
}

export function lireState(state) {
  try {
    const cfg = configSonos();
    if (!cfg || typeof state !== "string") return null;
    const [corps, signature] = state.split(".");
    if (!corps || !signature) return null;
    const a = Buffer.from(signature);
    const b = Buffer.from(signer(corps, cfg.secret));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const p = JSON.parse(Buffer.from(corps, "base64url").toString("utf8"));
    if (!(p.x > Date.now()) || !p.e) return null;
    return { entrepriseId: p.e, userId: p.u || null };
  } catch {
    return null;
  }
}

export function lienAutorisation(request, state) {
  const cfg = configSonos();
  const p = new URLSearchParams({ client_id: cfg.clientId, response_type: "code", state, scope: "playback-control-all", redirect_uri: adresseRetour(request) });
  return `${AUTORISER}?${p.toString()}`;
}

async function demanderJeton(corps) {
  const cfg = configSonos();
  const res = await fetch(URL_JETON(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      Authorization: "Basic " + Buffer.from(`${cfg.clientId}:${cfg.secret}`).toString("base64"),
    },
    body: new URLSearchParams(corps).toString(),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || `Sonos a refusé (${res.status}).`);
  return data;
}

export const echangerCode = (code, redirectUri) => demanderJeton({ grant_type: "authorization_code", code, redirect_uri: redirectUri });

export async function enregistrerJetons(service, entrepriseId, data, userId) {
  const ligne = {
    entreprise_id: entrepriseId,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + (Number(data.expires_in) || 86400) * 1000).toISOString(),
    maj: new Date().toISOString(),
  };
  if (userId) ligne.cree_par = userId;
  const { error } = await service.from("sonos_connexions").upsert(ligne, { onConflict: "entreprise_id" });
  if (error) throw new Error(error.message);
}

async function rafraichir(service, connexion) {
  const data = await demanderJeton({ grant_type: "refresh_token", refresh_token: connexion.refresh_token });
  const jetons = { ...data, refresh_token: data.refresh_token || connexion.refresh_token };
  await enregistrerJetons(service, connexion.entreprise_id, jetons);
  return jetons.access_token;
}

async function lireConnexion(service, entrepriseId) {
  const { data } = await service.from("sonos_connexions").select("*").eq("entreprise_id", entrepriseId).maybeSingle();
  return data || null;
}

async function envoyerSansExces(envoyer, jeton, essaisMax = 2) {
  let res = await envoyer(jeton);
  for (let essai = 0; essai < essaisMax && res.status === 429; essai++) {
    const attente = Number(res.headers.get("retry-after"));
    await new Promise((r) => setTimeout(r, Math.min(Math.max(Number.isFinite(attente) && attente > 0 ? attente * 1000 : 800, 400), 2500)));
    res = await envoyer(jeton);
  }
  return res;
}

// Appel de l'API Sonos au nom de l'entreprise : jeton rafraîchi au besoin, un seul nouvel essai sur 401.
// Retourne { ok, status, data } ; « non-lie » si aucun compte Sonos n'est lié, « expire » si la liaison n'est plus valide.
// options.sansReessai : pas de nouvel essai sur 429 (appels secondaires d'une lecture d'état : on ne veut pas empirer la situation).
// Frein : quand Sonos répond « trop de demandes », on arrête de l'interroger pour cette entreprise pendant un moment. Continuer à
// insister (chaque écran redemande toutes les quelques secondes) maintient le blocage au lieu de le laisser se lever.
const PAUSE_APRES_429_MS = 45000;
const freins = new Map(); // entrepriseId -> instant de fin de pause

export async function appelSonos(service, entrepriseId, methode, chemin, corps, options = {}) {
  const finPause = freins.get(entrepriseId) || 0;
  if (finPause > Date.now()) {
    const reste = Math.ceil((finPause - Date.now()) / 1000);
    return { ok: false, status: 429, data: {}, erreur: "Erreur Sonos (429)", detail: `pause de sécurité après un refus de Sonos, encore ${reste} s` };
  }
  const r = await appelSonosDirect(service, entrepriseId, methode, chemin, corps, options);
  if (r.status === 429) freins.set(entrepriseId, Date.now() + PAUSE_APRES_429_MS);
  return r;
}

async function appelSonosDirect(service, entrepriseId, methode, chemin, corps, options = {}) {
  const connexion = await lireConnexion(service, entrepriseId);
  if (!connexion) return { ok: false, status: 409, erreur: "non-lie" };

  let jeton = connexion.access_token;
  try {
    if (new Date(connexion.expires_at).getTime() - Date.now() < MARGE_RAFRAICHISSEMENT_MS) jeton = await rafraichir(service, connexion);
  } catch {
    return { ok: false, status: 401, erreur: "expire" };
  }

  const envoyer = (j) =>
    fetch(API() + chemin, {
      method: methode,
      headers: { Authorization: `Bearer ${j}`, "Content-Type": "application/json", "X-Sonos-Api-Key": configSonos()?.clientId || "" },
      body: corps ? JSON.stringify(corps) : undefined,
      cache: "no-store",
    });

  // Sonos limite le nombre de demandes (429 « trop de demandes ») : on attend un instant et on réessaie, deux fois au plus.
  const essais = options.sansReessai ? 0 : 1; // un seul nouvel essai : insister empire le blocage
  let res = await envoyerSansExces(envoyer, jeton, essais);
  if (res.status === 401) {
    try {
      jeton = await rafraichir(service, connexion);
    } catch {
      return { ok: false, status: 401, erreur: "expire" };
    }
    res = await envoyerSansExces(envoyer, jeton, essais);
  }
  const data = await res.json().catch(() => ({}));
  // detail : de quoi comprendre un refus de Sonos (quel appel, quel code, combien de temps attendre).
  const attente = Number(res.headers.get("retry-after"));
  const detail = res.ok ? null : `${methode} ${chemin.replace(/[0-9A-Za-z_-]{12,}/g, "…")} -> ${res.status}${Number.isFinite(attente) && attente > 0 ? `, attendre ${attente} s` : ""}${data?.reason ? ` (${data.reason})` : ""}`;
  return { ok: res.ok, status: res.status, data, erreur: res.ok ? null : data?.reason || data?.errorCode || `Erreur Sonos (${res.status})`, detail };
}

// Foyer (household) Sonos de l'entreprise, mémorisé après la première découverte. Un compte peut en avoir plusieurs (ancien système,
// système de test...) : on prend le premier qui a vraiment des haut-parleurs, sinon le premier de la liste.
export async function foyer(service, entrepriseId) {
  const connexion = await lireConnexion(service, entrepriseId);
  if (connexion?.household_id) return { id: connexion.household_id, memorise: true };
  const r = await appelSonos(service, entrepriseId, "GET", "/households");
  if (!r.ok) return { erreur: r.erreur, status: r.status, detail: r.detail };
  const liste = r.data?.households || [];
  if (liste.length === 0) {
    return { erreur: "Sonos ne voit aucun système sur ce compte. Reconnecte-toi et, dans la fenêtre de Sonos, choisis ton système.", status: 404 };
  }
  let id = liste[0].id;
  if (liste.length > 1) {
    for (const h of liste) {
      const g = await appelSonos(service, entrepriseId, "GET", `/households/${h.id}/groups`);
      if (g.ok && (g.data?.groups || []).length > 0) {
        id = h.id;
        break;
      }
    }
  }
  await service.from("sonos_connexions").update({ household_id: id }).eq("entreprise_id", entrepriseId);
  return { id };
}

// Authentification d'une requête du tableau de bord : membre de l'entreprise (la RLS de « entreprises » le vérifie).
export async function contexteSonos(request, entrepriseId) {
  const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return { reponse: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  const { user, entreprise } = await getUserEntrepriseParId(getSupabaseForToken(token), token, entrepriseId);
  if (!user) return { reponse: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  if (!entreprise) return { reponse: NextResponse.json({ error: "Aucune entreprise associée à ce compte." }, { status: 400 }) };
  const service = getServiceClient();
  if (!service) return { reponse: NextResponse.json({ error: "Le service n'est pas configuré." }, { status: 501 }) };
  return { user, entreprise, service };
}

export function reponseErreurSonos(r) {
  if (r.erreur === "non-lie") return NextResponse.json({ error: "Aucun compte Sonos lié.", code: "non-lie" }, { status: 409 });
  if (r.erreur === "expire") return NextResponse.json({ error: "La liaison avec Sonos n'est plus valide : lie ton compte de nouveau.", code: "expire" }, { status: 401 });
  return NextResponse.json({ error: r.erreur || "Sonos n'a pas répondu.", code: "sonos", detail: r.detail || null }, { status: r.status >= 400 && r.status < 600 ? r.status : 502 });
}

// État de lecture simplifié de chaque groupe et de chaque haut-parleur.
export async function lireEtat(service, entrepriseId) {
  let f = await foyer(service, entrepriseId);
  if (f.erreur) return { ok: false, erreur: f.erreur, status: f.status, detail: f.detail };
  let g = await appelSonos(service, entrepriseId, "GET", `/households/${f.id}/groups`);
  // Foyer mémorisé qui répond mais qui est vide (une erreur, comme « trop de demandes », ne compte pas) : on le redécouvre une fois (ancien système, autre foyer choisi à la reconnexion).
  if (f.memorise && g.ok && (g.data?.groups || []).length === 0) {
    await service.from("sonos_connexions").update({ household_id: null }).eq("entreprise_id", entrepriseId);
    const f2 = await foyer(service, entrepriseId);
    if (!f2.erreur && f2.id !== f.id) {
      f = f2;
      g = await appelSonos(service, entrepriseId, "GET", `/households/${f.id}/groups`);
    }
  }
  if (!g.ok) return g;

  const joueursBruts = g.data?.players || [];
  const sauf = (p) => p.then((r) => (r.ok ? r.data : null)).catch(() => null);

  const groupes = await Promise.all(
    (g.data?.groups || []).map(async (grp) => {
      const [vol, meta, lecture] = await Promise.all([
        sauf(appelSonos(service, entrepriseId, "GET", `/groups/${grp.id}/groupVolume`, undefined, { sansReessai: true })),
        sauf(appelSonos(service, entrepriseId, "GET", `/groups/${grp.id}/playbackMetadata`, undefined, { sansReessai: true })),
        // Position dans la chanson (positionMillis) : pour la barre de progression.
        sauf(appelSonos(service, entrepriseId, "GET", `/groups/${grp.id}/playback`, undefined, { sansReessai: true })),
      ]);
      const piste = meta?.currentItem?.track;
      const joueurs = await Promise.all(
        (grp.playerIds || []).map(async (id) => {
          const v = await sauf(appelSonos(service, entrepriseId, "GET", `/players/${id}/playerVolume`, undefined, { sansReessai: true }));
          return { id, nom: joueursBruts.find((p) => p.id === id)?.name || "Haut-parleur", volume: v?.volume ?? null, muet: !!v?.muted };
        })
      );
      return {
        id: grp.id,
        nom: grp.name,
        etat: String(grp.playbackState || "").replace("PLAYBACK_STATE_", "") || "IDLE",
        volume: vol?.volume ?? null,
        muet: !!vol?.muted,
        titre: piste?.name || meta?.container?.name || null,
        artiste: piste?.artist?.name || null,
        image: piste?.imageUrl || meta?.container?.imageUrl || null,
        // Progression : durée 0 = flux sans durée (radio...) -> pas de barre. positionMs vient de la dernière lecture ;
        // l'affichage l'avance lui-même entre deux lectures.
        dureeMs: Number(piste?.durationMillis) > 0 ? Number(piste.durationMillis) : 0,
        positionMs: Number.isFinite(lecture?.positionMillis) ? lecture.positionMillis : null,
        // Se déplacer dans la chanson : permis sauf si Sonos dit explicitement que non (certains services le bloquent).
        peutChercher: (lecture?.availablePlaybackActions?.canSeek ?? lecture?.canSeek) !== false,
        itemId: lecture?.itemId || null,
        joueurs,
      };
    })
  );
  return { ok: true, data: { groupes } };
}

// Réponses « état » gardées quelques secondes par entreprise (voir app/api/sonos/etat). Toute commande, liaison ou déliaison
// l'efface pour que l'écran montre tout de suite le vrai état.
export const cacheEtat = new Map();
export function oublierEtat(entrepriseId) {
  cacheEtat.delete(entrepriseId);
}
