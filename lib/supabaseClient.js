import { createClient } from "@supabase/supabase-js";
import { demoActif } from "@/lib/demo/actif";

// Ces deux valeurs viennent de ton projet Supabase (Project Settings > API).
// Elles doivent être mises dans un fichier .env.local (voir .env.local.example)
// et JAMAIS commitées directement dans le code.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_CLE_PUBLIQUE;

const reel = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ---------------------------------------------------------------------------------------------------------------
// Mode démo (voir lib/demo/*) : quand le drapeau de démo est actif dans cet onglet, TOUS les appels vont vers une fausse
// base qui vit dans le navigateur, jamais vers le vrai Supabase. Le code de la démo est chargé à la demande : les
// visiteurs normaux n'en téléchargent rien. Pendant son chargement, les appels sont « enregistrés » puis rejoués.
// ---------------------------------------------------------------------------------------------------------------
let demo = null;
let chargement = null;

export function chargerDemo() {
  if (!chargement) {
    chargement = import("@/lib/demo/client").then((m) => {
      m.preparerDemo();
      demo = m.clientDemo;
      return demo;
    });
  }
  return chargement;
}

function rejouer(racine, etapes) {
  let parent = null;
  let courant = racine;
  for (const e of etapes) {
    if (e.prop !== undefined) {
      parent = courant;
      courant = courant[e.prop];
    } else {
      courant = courant.apply(parent, e.args);
      parent = null;
    }
  }
  return courant;
}

function enregistreur(etapes) {
  return new Proxy(function () {}, {
    get(_, prop) {
      if (prop === "then") {
        return (res, rej) =>
          chargerDemo()
            .then((d) => rejouer(d, etapes))
            .then(res, rej);
      }
      return enregistreur([...etapes, { prop }]);
    },
    apply(_, __, args) {
      return enregistreur([...etapes, { args }]);
    },
  });
}

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

const authDemoEnAttente = new Proxy(
  {},
  {
    get(_, prop) {
      // onAuthStateChange rend son résultat tout de suite (la suite attend le chargement de la démo).
      if (prop === "onAuthStateChange") {
        return (cb) => {
          let actif = true;
          chargerDemo().then((d) => {
            if (actif) d.auth.onAuthStateChange(cb);
          });
          return { data: { subscription: { unsubscribe: () => (actif = false) } } };
        };
      }
      return enregistreur([{ prop: "auth" }, { prop }]);
    },
  }
);

export const supabase = new Proxy(reel, {
  get(cible, prop) {
    if (!demoActif()) {
      const v = cible[prop];
      return typeof v === "function" ? v.bind(cible) : v;
    }
    if (prop === "channel") return () => canalFactice;
    if (prop === "removeChannel") return () => Promise.resolve("ok");
    if (demo) return demo[prop];
    if (prop === "auth") return authDemoEnAttente;
    return enregistreur([{ prop }]);
  },
});
