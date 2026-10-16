import { createClient } from "@supabase/supabase-js";
import { LABELS_FORFAIT } from "@/lib/modules";

// Client sans cache (Next.js met sinon en cache les lectures et les infos resteraient périmées).
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { global: { fetch: (u, o) => fetch(u, { ...o, cache: "no-store" }) } });
}

// Compte Gozly lié à chaque identifiant Discord (nom, courriel, forfait, entreprises). Utilisé par le panneau admin
// et par l'encadré "Compte Gozly" posé dans les nouveaux tickets (visible par la personne, les admins et les modérateurs).
// Si la liaison n'est pas disponible (SQL pas exécuté, personne non liée), il n'y a simplement pas de compte.
// Retourne { comptes, diagnostic } : "diagnostic" explique pourquoi aucun compte n'a été trouvé (aide au dépannage).
export async function comptesLies(discordIds) {
  const comptes = new Map();
  const service = db();
  if (!service) return { comptes, diagnostic: "Clé serveur Supabase absente (SUPABASE_SERVICE_ROLE_KEY)." };
  if (discordIds.length === 0) return { comptes, diagnostic: null };
  let diagnostic = null;
  try {
    const { data: profils, error } = await service.from("profils").select("id, full_name, forfait, discord_id").in("discord_id", discordIds);
    if (error) return { comptes, diagnostic: `Lecture des comptes impossible : ${error.message}` };
    if (!profils?.length) return { comptes, diagnostic: `Aucun compte Gozly n'a l'identifiant Discord de ces personnes (${discordIds.join(", ")}).` };
    const userIds = profils.map((p) => p.id);
    const { data: membres } = await service.from("membres").select("entreprise_id, user_id, role").in("user_id", userIds);
    const entrepriseIds = [...new Set((membres || []).map((m) => m.entreprise_id))];
    const { data: entreprises } = entrepriseIds.length ? await service.from("entreprises").select("id, nom").in("id", entrepriseIds) : { data: [] };
    const nomEntreprise = new Map((entreprises || []).map((e) => [e.id, e.nom]));
    for (const p of profils) {
      let courriel = null;
      try {
        courriel = (await service.auth.admin.getUserById(p.id)).data?.user?.email || null;
      } catch {}
      comptes.set(p.discord_id, {
        nom: p.full_name || "",
        courriel,
        forfait: LABELS_FORFAIT[p.forfait] || null,
        entreprises: (membres || [])
          .filter((m) => m.user_id === p.id && nomEntreprise.has(m.entreprise_id))
          .map((m) => ({ nom: nomEntreprise.get(m.entreprise_id), role: m.role })),
      });
    }
  } catch (e) {
    diagnostic = `Erreur en cherchant les comptes : ${e.message}`;
  }
  return { comptes, diagnostic };
}

