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
