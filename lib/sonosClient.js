import { supabase } from "@/lib/supabaseClient";

// Appel d'une route /api/sonos/* depuis le tableau de bord (jeton de la session Supabase). Retourne { ok, status, data }.
export async function sonosApi(chemin, { method = "GET", body } = {}) {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  try {
    const res = await fetch(chemin, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Connexion impossible." } };
  }
}

export const ETATS_LECTURE = {
  PLAYING: "En lecture",
  PAUSED: "En pause",
  IDLE: "Arrêté",
  BUFFERING: "Chargement...",
};

// Rythme de rafraîchissement des écrans Musique. Sonos limite chaque compte à 20 000 demandes par jour : un écran qui reste ouvert
// toute la journée (kiosque) doit donc être économe. Tant que quelqu'un touche l'écran : on redemande souvent si quelque chose joue,
// moins si tout est arrêté. Sans aucun toucher depuis 10 minutes (tablette laissée seule) : une demande toutes les 2 minutes.
// La barre de progression avance toute seule entre deux lectures, et une action faite dans Gozly rafraîchit tout de suite.
let derniereActivite = Date.now();
let ecouteActivite = false;
function suivreActivite() {
  if (ecouteActivite || typeof window === "undefined") return;
  ecouteActivite = true;
  const marque = () => {
    derniereActivite = Date.now();
  };
  for (const e of ["pointerdown", "keydown", "touchstart", "wheel"]) window.addEventListener(e, marque, { passive: true });
}

export function delaiRafraichissement(groupes, lecture = 15000, repos = 45000, inactif = 120000) {
  suivreActivite();
  if (Date.now() - derniereActivite > 10 * 60 * 1000) return inactif;
  const joue = (groupes || []).some((g) => g.etat === "PLAYING" || g.etat === "BUFFERING");
  return joue || !groupes ? lecture : repos;
}

// Pause avant de redemander après un 429 : jusqu'à la remise à zéro du quota annoncée par Sonos (6 h au plus), sinon 1 minute.
export function pauseApres429(r) {
  const s = Number(r?.data?.reprise);
  return (Number.isFinite(s) && s > 0 ? Math.min(s, 21600) : 60) * 1000;
}
