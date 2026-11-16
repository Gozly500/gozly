import { supabase } from "@/lib/supabaseClient";
import { imprimerBonsLocaux } from "@/lib/impressionLocale";

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

// Recalcule les tâches "Réservations" (à appeler après avoir
// ajouté / modifié / retiré une commande manuelle). Silencieux en cas d'échec.
export async function mettreAJourTachesCommandes(entrepriseId) {
  try {
    await fetch("/api/commandes/taches", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ entrepriseId }),
    });
  } catch {}
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
    // Sur la tablette (app Android), le bon qu'on vient de mettre en file s'imprime tout de suite, sans attendre la synchronisation.
    if (res.ok) imprimerBonsLocaux(entrepriseId);
    return { ok: res.ok, error: data.error };
  } catch {
    return { ok: false, error: "L'impression a échoué." };
  }
}

// Annule (annulee = true) ou rétablit une commande, y compris une commande en ligne (l'annulation n'existe que dans Gozly).
export async function annulerCommande(entrepriseId, commandeId, annulee = true) {
  try {
    const res = await fetch("/api/commandes/annuler", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ entrepriseId, commandeId, annulee }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    return { ok: false, error: `${data.error || "Impossible de changer la commande."}${data.detail ? ` [${data.detail}]` : ""}` };
  } catch {
    return { ok: false, error: "Impossible de changer la commande." };
  }
}

// Modifie une commande en ligne (client, ramassage, articles, note) : seulement dans Gozly, Wix n'est pas touché.
export async function modifierCommandeEnLigne(entrepriseId, commandeId, commande) {
  try {
    const res = await fetch("/api/commandes/modifier", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ entrepriseId, commandeId, commande }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    return { ok: false, error: `${data.error || "Impossible d'enregistrer la commande."}${data.detail ? ` [${data.detail}]` : ""}` };
  } catch {
    return { ok: false, error: "Impossible d'enregistrer la commande." };
  }
}

// L'impression est-elle configurée pour cette entreprise ?
export async function impressionActive(entrepriseId) {
  const { data } = await supabase.from("entreprises").select("impression_actif").eq("id", entrepriseId).maybeSingle();
  return !!data?.impression_actif;
}

// Change l'étape d'une commande. Retourne { ok, error } (error contient la
// raison du serveur, ex: colonne manquante si un fichier SQL n'a pas été exécuté).
// statutWix (modèle Wix du kiosque) : le statut de préparation Wix voulu ; { ok, error, avertissement } (avertissement = Wix n'a pas suivi).
export async function changerEtapeCommande(entrepriseId, commandeId, etape, statutWix = null) {
  try {
    const res = await fetch("/api/commandes/etape", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ entrepriseId, commandeId, etape, ...(statutWix ? { statutWix } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, avertissement: data.avertissement || null };
    return { ok: false, error: `${data.error || "Impossible de changer l'étape."}${data.detail ? ` [${data.detail}]` : ""}` };
  } catch {
    return { ok: false, error: "Impossible de changer l'étape." };
  }
}

// Synchronisation automatique répétée. Ouvert : toutes les 30 s, puis toutes les 60 s après 4 tours sans nouvelle commande
// (retour à 30 s dès qu'une commande arrive). Fermé (selon les horaires d'ouverture) : une vérification aux 10 minutes.
// Si Wix nous envoie déjà les commandes par webhook (`webhook_actif` dans la réponse de la synchro), la synchro avec Wix ne sert plus
// que de secours (aux 5 minutes) et `lecture` (simple lecture de la base, sans passer par Vercel) rafraîchit l'écran aux 15 s.
// Écran caché : rien ne part. `executer` doit retourner la réponse de la synchro ({ nouvelles, webhook_actif }). Retourne la fonction qui arrête.
export const SYNCHRO_RAPIDE_MS = 30000;
export const SYNCHRO_LENTE_MS = 60000;
export const SYNCHRO_FERME_MS = 600000;
export const SYNCHRO_SECURITE_MS = 300000;
export const LECTURE_WEBHOOK_MS = 15000;
const TOURS_CALMES = 4;

export function planifierSynchro(executer, estOuvert = () => true, lecture = null) {
  let arrete = false;
  let timer = null;
  let calmes = 0;
  let webhook = false;

  const timerLecture = lecture
    ? setInterval(() => {
        if (webhook && document.visibilityState === "visible" && estOuvert()) Promise.resolve(lecture()).catch(() => {});
      }, LECTURE_WEBHOOK_MS)
    : null;

  async function tour() {
    if (arrete) return;
    let delai = SYNCHRO_RAPIDE_MS;
    if (document.visibilityState === "visible") {
      if (estOuvert()) {
        const r = await Promise.resolve(executer()).catch(() => null);
        webhook = !!(r && r.webhook_actif);
        calmes = r && r.nouvelles > 0 ? 0 : calmes + 1;
        delai = webhook ? SYNCHRO_SECURITE_MS : calmes >= TOURS_CALMES ? SYNCHRO_LENTE_MS : SYNCHRO_RAPIDE_MS;
      } else {
        delai = SYNCHRO_FERME_MS;
      }
    }
    if (!arrete) timer = setTimeout(tour, delai);
  }

  timer = setTimeout(tour, SYNCHRO_RAPIDE_MS);
  return () => {
    arrete = true;
    clearTimeout(timer);
    if (timerLecture) clearInterval(timerLecture);
  };
}
