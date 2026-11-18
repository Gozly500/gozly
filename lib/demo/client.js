import { from, lignes, chargerEtat, reinitialiserEtat, definirSemence } from "./moteur";
import { semer, UTILISATEUR_DEMO, ENTREPRISE_DEMO } from "./donnees";
import { installerFetchDemo } from "./api";
import { quitterDemo } from "./actif";

// Faux client Supabase de la démo : même forme que le vrai (`supabase.from(...)`, `supabase.auth...`), branché sur le
// moteur en mémoire. Aucun appel réseau. Chargé à la demande par lib/supabaseClient.js, seulement quand la démo est active.

definirSemence(semer);

const sessionDemo = () => ({
  access_token: "demo",
  refresh_token: "demo",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: UTILISATEUR_DEMO.id,
    email: UTILISATEUR_DEMO.email,
    app_metadata: {},
    user_metadata: { full_name: UTILISATEUR_DEMO.nom },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  },
});

const ok = (data = null) => Promise.resolve({ data, error: null });

const auth = {
  getSession: () => {
    chargerEtat();
    return ok({ session: sessionDemo() });
  },
  getUser: () => {
    chargerEtat();
    return ok({ user: sessionDemo().user });
  },
  onAuthStateChange: (cb) => {
    // Comme le vrai client : un premier événement avec la session actuelle.
    setTimeout(() => {
      try {
        cb("INITIAL_SESSION", sessionDemo());
      } catch {}
    }, 0);
    return { data: { subscription: { unsubscribe() {} } } };
  },
  // Se « déconnecter » = quitter la démo (les données restent enregistrées dans le navigateur).
  signOut: () => {
    quitterDemo();
    return ok().then((r) => {
      if (typeof window !== "undefined") window.location.assign("/");
      return r;
    });
  },
  updateUser: () => ok({ user: sessionDemo().user }),
  resetPasswordForEmail: () => ok({}),
  signInWithPassword: () => ok({ session: sessionDemo(), user: sessionDemo().user }),
  signUp: () => ok({ session: sessionDemo(), user: sessionDemo().user }),
  mfa: {
    getAuthenticatorAssuranceLevel: () => ok({ currentLevel: "aal1", nextLevel: "aal1" }),
    listFactors: () => ok({ all: [], totp: [], phone: [], webauthn: [] }),
    enroll: () => Promise.resolve({ data: null, error: { message: "Indisponible dans la démo." } }),
    challengeAndVerify: () => Promise.resolve({ data: null, error: { message: "Indisponible dans la démo." } }),
    unenroll: () => ok({}),
    webauthn: {
      register: () => Promise.resolve({ data: null, error: { message: "Indisponible dans la démo." } }),
      authenticate: () => Promise.resolve({ data: null, error: { message: "Indisponible dans la démo." } }),
    },
  },
};

// Images (logos, avatars...) : rien n'est envoyé ; on garde l'image dans la démo sous forme d'adresse locale.
const stockage = {
  from: (seau) => ({
    upload: (chemin, fichier) => {
      try {
        if (typeof window !== "undefined" && fichier && typeof URL !== "undefined" && URL.createObjectURL) {
          window.__demoFichiers = window.__demoFichiers || {};
          window.__demoFichiers[`${seau}/${chemin}`] = URL.createObjectURL(fichier);
        }
      } catch {}
      return ok({ path: chemin });
    },
    getPublicUrl: (chemin) => ({ data: { publicUrl: (typeof window !== "undefined" && window.__demoFichiers?.[`${seau}/${chemin}`]) || "" } }),
    remove: () => ok([]),
    list: () => ok([]),
    createSignedUrl: () => ok({ signedUrl: "" }),
  }),
};

const canalFactice = {
  on() {
    return canalFactice;
  },
  subscribe() {
    return canalFactice;
  },
  send: () => Promise.resolve("ok"),
  unsubscribe: () => Promise.resolve("ok"),
};

export const clientDemo = {
  from,
  auth,
  storage: stockage,
  rpc: () => ok(null),
  channel: () => canalFactice,
  removeChannel: () => Promise.resolve("ok"),
  functions: { invoke: () => ok(null) },
};

// Outils pour le bandeau de démo et le bouton « Démo ».
export function preparerDemo() {
  chargerEtat();
  installerFetchDemo();
}

export function recommencerDemo() {
  reinitialiserEtat();
}

export { lignes, ENTREPRISE_DEMO };
