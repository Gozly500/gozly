import { supabase } from "@/lib/supabaseClient";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// Demande une synchronisation avec Wix. Retourne { ok, count, error, detail }.
export async function synchroniserCommandes(entrepriseId) {
  try {
    const res = await fetch("/api/commandes/synchroniser", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ entrepriseId }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, ...data };
  } catch {
    return { ok: false, error: "La synchronisation a échoué." };
  }
}

// Envoie le bon d'une commande à l'imprimante. mode "manuel" (bouton
// Imprimer) ou "creation" (juste après la création d'une commande manuelle :
// n'imprime que si le réglage est "automatique"). Retourne { ok, error }.
export async function imprimerCommande(entrepriseId, commandeId, mode = "manuel") {
  try {
    const res = await fetch("/api/commandes/imprimer", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ entrepriseId, commandeId, mode }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: data.error };
  } catch {
    return { ok: false, error: "L'impression a échoué." };
  }
}

// L'impression est-elle configurée pour cette entreprise ?
export async function impressionActive(entrepriseId) {
  const { data } = await supabase.from("entreprises").select("impression_actif").eq("id", entrepriseId).maybeSingle();
  return !!data?.impression_actif;
}

// Change l'étape d'une commande. Retourne { ok, error } (error contient la
// raison du serveur, ex: colonne manquante si un fichier SQL n'a pas été exécuté).
export async function changerEtapeCommande(entrepriseId, commandeId, etape) {
  try {
    const res = await fetch("/api/commandes/etape", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ entrepriseId, commandeId, etape }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    return { ok: false, error: `${data.error || "Impossible de changer l'étape."}${data.detail ? ` [${data.detail}]` : ""}` };
  } catch {
    return { ok: false, error: "Impossible de changer l'étape." };
  }
}
