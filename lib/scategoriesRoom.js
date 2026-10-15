// Salle de jeu temporaire pour Scategories multijoueur.
// Tout passe par Supabase Realtime (broadcast + presence) : AUCUNE table, rien n'est stocké.
// Quand tout le monde quitte, la salle n'existe plus. En développement seulement, le paramètre
// ?local=1 remplace Supabase par un BroadcastChannel (plusieurs onglets du même navigateur) pour tester.
import { supabase } from "@/lib/supabaseClient";

const SYMBOLES = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sans I, L, O, 0, 1 (faciles à confondre)

export function genererCode() {
  let c = "";
  for (let i = 0; i < 4; i++) c += SYMBOLES[Math.floor(Math.random() * SYMBOLES.length)];
  return c;
}

export function normaliserCode(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

export function genererId() {
  return Math.random().toString(36).slice(2, 10);
}

export function modeLocal() {
  return process.env.NODE_ENV !== "production" && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("local");
}

// ouvrirSalle(code, meta) -> Promise<{ envoyer(msg), surMessage(cb), surPresence(cb), quitter() }>
// meta = { id, nom, role } ; les messages sont de simples objets JSON.
export function ouvrirSalle(code, meta) {
  return modeLocal() ? ouvrirLocal(code, meta) : ouvrirSupabase(code, meta);
}

function ouvrirSupabase(code, meta) {
  return new Promise((resolve, reject) => {
    const canal = supabase.channel("scat:" + code, { config: { broadcast: { self: false }, presence: { key: meta.id } } });
    const ecouteursMsg = [];
    const ecouteursPres = [];

    canal.on("broadcast", { event: "m" }, ({ payload }) => ecouteursMsg.forEach((cb) => cb(payload)));
    canal.on("presence", { event: "sync" }, () => {
      const liste = Object.values(canal.presenceState()).flat();
      ecouteursPres.forEach((cb) => cb(liste));
    });

    const delai = setTimeout(() => reject(new Error("timeout")), 10000);
    canal.subscribe(async (statut) => {
      if (statut === "SUBSCRIBED") {
        clearTimeout(delai);
        await canal.track({ ...meta, ts: Date.now() });
        resolve({
          envoyer: (msg) => canal.send({ type: "broadcast", event: "m", payload: msg }),
          surMessage: (cb) => ecouteursMsg.push(cb),
          surPresence: (cb) => ecouteursPres.push(cb),
          quitter: () => supabase.removeChannel(canal),
        });
      } else if (statut === "CHANNEL_ERROR" || statut === "TIMED_OUT") {
        clearTimeout(delai);
        reject(new Error(statut));
      }
    });
  });
}

// Version de test : BroadcastChannel + présence simulée par des "hello" réguliers.
function ouvrirLocal(code, meta) {
  const bc = new BroadcastChannel("scat:" + code);
  const ecouteursMsg = [];
  const ecouteursPres = [];
  const vus = new Map(); // id -> { meta, vu }
  const ts = Date.now();

  function notifier() {
    const maintenant = Date.now();
    for (const [id, p] of vus) if (maintenant - p.vu > 6000) vus.delete(id);
    const liste = [{ ...meta, ts }, ...[...vus.values()].map((p) => p.meta)];
    ecouteursPres.forEach((cb) => cb(liste));
  }
  const hello = () => bc.postMessage({ p: "hello", meta: { ...meta, ts } });

  bc.onmessage = (e) => {
    const d = e.data;
    if (d.p === "hello") {
      const nouveau = !vus.has(d.meta.id);
      vus.set(d.meta.id, { meta: d.meta, vu: Date.now() });
      if (nouveau) {
        hello();
        notifier();
      }
    } else if (d.p === "bye") {
      vus.delete(d.id);
      notifier();
    } else if (d.m) {
      ecouteursMsg.forEach((cb) => cb(d.m));
    }
  };
  const battement = setInterval(() => {
    hello();
    notifier();
  }, 2000);
  hello();

  return Promise.resolve({
    envoyer: (msg) => bc.postMessage({ m: msg }),
    surMessage: (cb) => ecouteursMsg.push(cb),
    surPresence: (cb) => {
      ecouteursPres.push(cb);
      notifier();
    },
    quitter: () => {
      clearInterval(battement);
      bc.postMessage({ p: "bye", id: meta.id });
      bc.close();
    },
  });
}
