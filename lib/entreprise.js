// Un compte peut maintenant appartenir à plusieurs entreprises (système
// d'équipe). On garde en mémoire (localStorage) l'entreprise "active"
// pour la session en cours, choisie par l'utilisateur si besoin.
const STORAGE_KEY = "gozly_entreprise_id";

export function getEntrepriseSelectionnee() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setEntrepriseSelectionnee(id) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
}

// Mode "voir le dashboard d'un client" pour le staff Gozly (admins) - ne
// touche pas à ses propres adhésions (membres), c'est juste une vue
// temporaire. L'accès réel est toujours vérifié par les policies "is_admin()"
// côté base de données, pas par ce qu'affirme le navigateur.
const IMPERSONATION_KEY = "gozly_admin_impersonation";

export function demarrerImpersonation(entrepriseId, entrepriseNom) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(IMPERSONATION_KEY, JSON.stringify({ id: entrepriseId, nom: entrepriseNom }));
}

export function getImpersonation() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(IMPERSONATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function arreterImpersonation() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(IMPERSONATION_KEY);
}

// Emplacement "actif" pour un module donné, mémorisé par entreprise -
// permet de garder le même choix en changeant de page (ex: la liste des
// journées de Planning puis l'éditeur d'une journée précise).
export function getEmplacementSelectionne(entrepriseId) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`gozly_emplacement_${entrepriseId}`);
}

export function setEmplacementSelectionne(entrepriseId, emplacementId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`gozly_emplacement_${entrepriseId}`, emplacementId);
}

// Liste toutes les entreprises auxquelles l'utilisateur a accès (via
// "membres"), avec le nom/logo pour l'affichage (sélecteur de dashboard).
// Important : on filtre explicitement sur son propre user_id - la policy
// RLS de "membres" autorise à VOIR toutes les lignes des entreprises dont
// on fait partie (utile pour afficher la liste des coéquipiers), donc sans
// ce filtre on récupère aussi les adhésions des AUTRES membres.
export async function listerMesEntreprises(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("membres")
    .select("role, entreprises(id, nom, logo_url)")
    .eq("user_id", user.id);

  return (data || [])
    .filter((m) => m.entreprises)
    .map((m) => ({ id: m.entreprises.id, nom: m.entreprises.nom, logo_url: m.entreprises.logo_url, role: m.role }));
}

async function compterInvitationsEnAttente(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return 0;

  const { count } = await supabase
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("email", user.email)
    .eq("statut", "en_attente");

  return count || 0;
}

// Détermine l'entreprise active pour cette session :
// - des invitations en attente -> l'appelant doit rediriger vers /invitations
// - 0 entreprise -> null (le compte n'a accès à rien)
// - 1 entreprise -> celle-là, automatiquement
// - plusieurs -> celle déjà choisie (localStorage) si toujours valide,
//   sinon null (l'appelant doit alors rediriger vers le sélecteur).
export async function resoudreEntrepriseActive(supabase) {
  const impersonation = getImpersonation();
  if (impersonation) {
    return {
      entrepriseId: impersonation.id,
      entreprises: [],
      besoinChoix: false,
      invitationsEnAttente: 0,
      impersonation,
    };
  }

  const invitationsEnAttente = await compterInvitationsEnAttente(supabase);
  if (invitationsEnAttente > 0) {
    return { entrepriseId: null, entreprises: [], besoinChoix: false, invitationsEnAttente };
  }

  const entreprises = await listerMesEntreprises(supabase);

  if (entreprises.length === 0) {
    return { entrepriseId: null, entreprises, besoinChoix: false, invitationsEnAttente: 0 };
  }
  if (entreprises.length === 1) {
    setEntrepriseSelectionnee(entreprises[0].id);
    return { entrepriseId: entreprises[0].id, entreprises, besoinChoix: false, invitationsEnAttente: 0 };
  }

  const selectionnee = getEntrepriseSelectionnee();
  if (selectionnee && entreprises.some((e) => e.id === selectionnee)) {
    return { entrepriseId: selectionnee, entreprises, besoinChoix: false, invitationsEnAttente: 0 };
  }

  return { entrepriseId: null, entreprises, besoinChoix: true, invitationsEnAttente: 0 };
}
