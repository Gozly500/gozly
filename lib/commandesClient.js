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

// Change l'étape d'une commande. Retourne true si ça a marché.
export async function changerEtapeCommande(entrepriseId, commandeId, etape) {
  try {
    const res = await fetch("/api/commandes/etape", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ entrepriseId, commandeId, etape }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
