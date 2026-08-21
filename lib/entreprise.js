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

// Liste toutes les entreprises auxquelles l'utilisateur a accès (via
// "membres"), avec le nom/logo pour l'affichage (sélecteur de dashboard).
export async function listerMesEntreprises(supabase) {
  const { data } = await supabase
    .from("membres")
    .select("role, entreprises(id, nom, logo_url)");

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
