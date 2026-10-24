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

// Rythme de rafraîchissement des écrans Musique : tant que quelque chose joue, on redemande souvent ; quand tout est en pause ou
// arrêté (rien ne bouge, pas de barre de progression), on laisse souffler Sonos (limite de demandes). La barre, elle, avance
// toute seule entre deux lectures, et une action faite dans Gozly rafraîchit tout de suite.
export function delaiRafraichissement(groupes, lecture = 12000, repos = 30000) {
  const joue = (groupes || []).some((g) => g.etat === "PLAYING" || g.etat === "BUFFERING");
  return joue || !groupes ? lecture : repos;
}
