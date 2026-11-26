import { CLE_DONNEES_DEMO } from "./actif";

// Mini « base de données » en mémoire qui imite ce que le code de Gozly utilise de Supabase (PostgREST) :
// from(table).select / insert / update / delete / upsert, les filtres (eq, in, gte...), order, limit, single,
// maybeSingle, count, et les sélections avec relations (« entreprises(nom) »). Les données sont gardées (le temps de l onglet) dans le
// sessionStorage du navigateur (une seule clé, écriture groupée) : rien n est envoyé nulle part et tout disparaît à la fermeture de l onglet.

const RELATIONS = {
  // "table.relation" -> { table: table liée, fk: colonne de la table courante }
  "membres.entreprises": { table: "entreprises", fk: "entreprise_id" },
  "invitations.entreprises": { table: "entreprises", fk: "entreprise_id" },
  "demandes_echange.planning_quarts": { table: "planning_quarts", fk: "quart_id" },
  "demandes_conge.planning_quarts": { table: "planning_quarts", fk: "quart_id" },
};

const DEVINER_TABLE = {
  equipement_id: "equipements_temperature",
  employe_id: "employes",
  entreprise_id: "entreprises",
  categorie_id: "categories",
};

let etat = null; // { tables: { nom: [lignes] }, meta: {...} }
let minuterie = null;
let semence = null; // fonction (etat) fournie par donnees.js, pour (ré)initialiser

export function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

export function definirSemence(fn) {
  semence = fn;
}

function sauvegarder() {
  // `window.__demoReset` : « Recommencer » / « Quitter » viennent d'effacer la démo, on ne la ré-écrit pas à la fermeture de la page.
  if (typeof window === "undefined" || !etat || window.__demoReset) return;
  try {
    window.sessionStorage.setItem(CLE_DONNEES_DEMO, JSON.stringify(etat));
  } catch {
    // Espace plein : on garde l'état en mémoire, la démo continue de fonctionner.
  }
}

function planifierSauvegarde() {
  if (minuterie) return;
  minuterie = setTimeout(() => {
    minuterie = null;
    sauvegarder();
  }, 400);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (minuterie) {
      clearTimeout(minuterie);
      minuterie = null;
    }
    sauvegarder();
  });
}

export function chargerEtat() {
  if (etat) return etat;
  try {
    const brut = window.sessionStorage.getItem(CLE_DONNEES_DEMO);
    if (brut) etat = JSON.parse(brut);
  } catch {}
  if (!etat || !etat.tables) {
    etat = { tables: {}, meta: {} };
    if (semence) semence(etat);
    sauvegarder();
  }
  return etat;
}

export function reinitialiserEtat() {
  etat = { tables: {}, meta: {} };
  if (semence) semence(etat);
  sauvegarder();
}

export function metaDemo() {
  return chargerEtat().meta;
}

function table(nom) {
  const e = chargerEtat();
  if (!e.tables[nom]) {
    e.tables[nom] = [];
    if (typeof window !== "undefined" && window.__demoDebug) console.warn("[démo] table vide ou inconnue :", nom);
  }
  return e.tables[nom];
}

const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

// ---------- Filtres ----------
function valeur(ligne, col) {
  if (col.includes("->>")) {
    const [c, k] = col.split("->>");
    const v = ligne[c];
    return v == null ? null : v[k];
  }
  return ligne[col];
}

function comparer(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function convertir(v, ref) {
  // Les valeurs des filtres « or(...) » arrivent en texte : on les rapproche du type de la colonne.
  if (typeof ref === "number") return Number(v);
  if (typeof ref === "boolean") return v === "true" || v === true;
  return v;
}

function testerOp(ligne, col, op, val) {
  const v = valeur(ligne, col);
  switch (op) {
    case "eq":
      return v === val || (v != null && val != null && String(v) === String(val));
    case "neq":
      return !(v === val || (v != null && val != null && String(v) === String(val)));
    case "gt":
      return v != null && comparer(v, val) > 0;
    case "gte":
      return v != null && comparer(v, val) >= 0;
    case "lt":
      return v != null && comparer(v, val) < 0;
    case "lte":
      return v != null && comparer(v, val) <= 0;
    case "like":
    case "ilike": {
      if (v == null) return false;
      const motif = String(val)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
      return new RegExp(`^${motif}$`, op === "ilike" ? "i" : "").test(String(v));
    }
    case "is":
      if (val === null || val === "null") return v == null;
      if (val === true || val === "true") return v === true;
      if (val === false || val === "false") return v === false;
      return false;
    case "in": {
      const liste = Array.isArray(val) ? val : String(val).replace(/^\(|\)$/g, "").split(",");
      return liste.some((x) => v === x || (v != null && String(v) === String(x)));
    }
    case "cs":
    case "contains": {
      if (Array.isArray(v)) return (Array.isArray(val) ? val : [val]).every((x) => v.includes(x));
      if (v && typeof v === "object" && val && typeof val === "object") return Object.entries(val).every(([k, x]) => v[k] === x);
      return false;
    }
    default:
      return true;
  }
}

function analyserOr(chaine) {
  // "a.eq.1,b.is.null" -> [{col, op, val}]
  const morceaux = [];
  let prof = 0;
  let courant = "";
  for (const c of chaine) {
    if (c === "(") prof++;
    if (c === ")") prof--;
    if (c === "," && prof === 0) {
      morceaux.push(courant);
      courant = "";
    } else courant += c;
  }
  if (courant) morceaux.push(courant);
  return morceaux.map((m) => {
    const [col, op, ...reste] = m.split(".");
    return { col, op, val: reste.join(".") };
  });
}

function ligneCorrespond(ligne, filtres) {
  for (const f of filtres) {
    if (f.ou) {
      const ok = f.ou.some((c) => {
        const ref = valeur(ligne, c.col);
        return testerOp(ligne, c.col, c.op, c.op === "is" || c.op === "in" ? c.val : convertir(c.val, ref));
      });
      if (!ok) return false;
    } else {
      const r = testerOp(ligne, f.col, f.op, f.val);
      if (f.non ? r : !r) return false;
    }
  }
  return true;
}

// ---------- Sélection avec relations ----------
function analyserSelection(texte) {
  // "*, entreprises(nom, logo_url), equipement:equipement_id(nom)" -> { etoile, colonnes, relations }
  const sel = { etoile: false, colonnes: [], relations: [] };
  let prof = 0;
  let courant = "";
  const parts = [];
  for (const c of texte || "*") {
    if (c === "(") prof++;
    if (c === ")") prof--;
    if (c === "," && prof === 0) {
      parts.push(courant);
      courant = "";
    } else courant += c;
  }
  if (courant) parts.push(courant);
  for (const p0 of parts) {
    const p = p0.trim();
    if (!p) continue;
    if (p === "*") sel.etoile = true;
    else if (p.includes("(")) {
      const i = p.indexOf("(");
      let tete = p.slice(0, i).trim();
      const interne = p.slice(i + 1, p.lastIndexOf(")"));
      let alias = null;
      if (tete.includes(":")) [alias, tete] = tete.split(":");
      sel.relations.push({ alias, tete: tete.replace("!inner", ""), interne });
    } else sel.colonnes.push(p);
  }
  return sel;
}

function appliquerSelection(ligne, sel, nomTable) {
  let sortie;
  if (sel.etoile) sortie = { ...ligne };
  else {
    sortie = {};
    for (const c of sel.colonnes) {
      if (c.includes(":")) {
        const [alias, col] = c.split(":");
        sortie[alias] = ligne[col];
      } else sortie[c] = ligne[c];
    }
  }
  for (const r of sel.relations) {
    let def = RELATIONS[`${nomTable}.${r.tete}`];
    if (!def && r.alias) {
      // alias:colonne_fk(cols) -> la table liée se devine avec le nom de la colonne
      def = { table: DEVINER_TABLE[r.tete] || r.tete.replace(/_id$/, "s"), fk: r.tete };
    }
    if (!def) {
      // sans définition : relation « un à plusieurs » (la table liée porte la clé de celle-ci)
      const fkInv = `${nomTable.replace(/s$/, "")}_id`;
      const liees = table(r.tete).filter((x) => x[fkInv] === ligne.id);
      const sousSel = analyserSelection(r.interne);
      sortie[r.alias || r.tete] = liees.map((x) => appliquerSelection(x, sousSel, r.tete));
      continue;
    }
    const cible = table(def.table).find((x) => x.id === ligne[def.fk]);
    sortie[r.alias || r.tete] = cible ? appliquerSelection(cible, analyserSelection(r.interne), def.table) : null;
  }
  return sortie;
}

const PROTEGEES = ["entreprises", "membres", "profils"];

// Suppressions en cascade (les « on delete cascade » de la vraie base).
const CASCADES = {
  employes: [["planning_quarts", "employe_id"], ["pointages", "employe_id"], ["employe_emplacements", "employe_id"], ["demandes_conge", "employe_id"], ["demandes_echange", "employe_id"], ["disponibilites", "employe_id"]],
  planning_quarts: [["demandes_echange", "quart_id"], ["demandes_conge", "quart_id"]],
  categories: [["taches", "categorie_id"]],
  categories_inventaire: [["produits_inventaire", "categorie_id"]],
  conversations: [["messages", "conversation_id"], ["conversation_participants", "conversation_id"]],
  equipements_temperature: [["releves_temperature", "equipement_id"]],
};

function cascadeSuppression(nomTable, supprimees) {
  const defs = CASCADES[nomTable];
  if (!defs || !supprimees.length) return;
  const ids = new Set(supprimees.map((x) => x.id));
  for (const [t, fk] of defs) {
    const liste = etat.tables[t];
    if (!liste) continue;
    const enlevees = liste.filter((x) => ids.has(x[fk]));
    if (!enlevees.length) continue;
    const set = new Set(enlevees);
    etat.tables[t] = liste.filter((x) => !set.has(x));
    cascadeSuppression(t, enlevees);
  }
}

// ---------- Constructeur de requête ----------
class Requete {
  constructor(nomTable) {
    this.t = nomTable;
    this.op = "select";
    this.charge = null;
    this.filtres = [];
    this.tris = [];
    this.lim = null;
    this.plage = null;
    this.unique = null; // "single" | "maybe"
    this.selTexte = "*";
    this.compte = false;
    this.tete = false;
    this.retourne = false; // select() après insert/update/delete
    this.conflit = null;
    this.ignorerDoublons = false;
  }
  select(texte = "*", opts = {}) {
    this.selTexte = texte;
    if (this.op !== "select") this.retourne = true;
    if (opts.count) this.compte = true;
    if (opts.head) this.tete = true;
    return this;
  }
  insert(charge) {
    this.op = "insert";
    this.charge = charge;
    return this;
  }
  upsert(charge, opts = {}) {
    this.op = "upsert";
    this.charge = charge;
    this.conflit = opts.onConflict ? String(opts.onConflict).split(",").map((s) => s.trim()) : null;
    this.ignorerDoublons = !!opts.ignoreDuplicates;
    return this;
  }
  update(charge) {
    this.op = "update";
    this.charge = charge;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col, val) { return this._f(col, "eq", val); }
  neq(col, val) { return this._f(col, "neq", val); }
  gt(col, val) { return this._f(col, "gt", val); }
  gte(col, val) { return this._f(col, "gte", val); }
  lt(col, val) { return this._f(col, "lt", val); }
  lte(col, val) { return this._f(col, "lte", val); }
  like(col, val) { return this._f(col, "like", val); }
  ilike(col, val) { return this._f(col, "ilike", val); }
  is(col, val) { return this._f(col, "is", val); }
  in(col, val) { return this._f(col, "in", val); }
  contains(col, val) { return this._f(col, "contains", val); }
  not(col, op, val) {
    this.filtres.push({ col, op, val, non: true });
    return this;
  }
  filter(col, op, val) { return this._f(col, op, val); }
  match(obj) {
    for (const [k, v] of Object.entries(obj || {})) this._f(k, "eq", v);
    return this;
  }
  or(chaine) {
    this.filtres.push({ ou: analyserOr(chaine) });
    return this;
  }
  _f(col, op, val) {
    this.filtres.push({ col, op, val });
    return this;
  }
  order(col, opts = {}) {
    this.tris.push({ col, asc: opts.ascending !== false });
    return this;
  }
  limit(n) {
    this.lim = n;
    return this;
  }
  range(a, b) {
    this.plage = [a, b];
    return this;
  }
  single() {
    this.unique = "single";
    return this;
  }
  maybeSingle() {
    this.unique = "maybe";
    return this;
  }
  returns() { return this; }
  abortSignal() { return this; }

  then(res, rej) {
    return Promise.resolve()
      .then(() => this._executer())
      .then(res, rej);
  }

  _executer() {
    const donnees = table(this.t);
    let lignes;

    if (this.op === "insert" || this.op === "upsert") {
      const liste = Array.isArray(this.charge) ? this.charge : [this.charge];
      const touchees = [];
      for (const brut of liste) {
        const ligne = { ...clone(brut) };
        if (this.op === "upsert") {
          const cles = this.conflit || ["id"];
          const existante = donnees.find((x) => cles.every((c) => ligne[c] !== undefined && x[c] === ligne[c]));
          if (existante) {
            if (!this.ignorerDoublons) Object.assign(existante, ligne);
            touchees.push(existante);
            continue;
          }
        }
        if (ligne.id === undefined) ligne.id = uuid();
        if (ligne.created_at === undefined) ligne.created_at = new Date().toISOString();
        donnees.push(ligne);
        touchees.push(ligne);
      }
      planifierSauvegarde();
      lignes = touchees;
    } else if (this.op === "update") {
      const touchees = donnees.filter((x) => ligneCorrespond(x, this.filtres));
      for (const l of touchees) Object.assign(l, clone(this.charge));
      planifierSauvegarde();
      lignes = touchees;
    } else if (this.op === "delete") {
      // L'entreprise, le compte et l'accès de démo ne peuvent pas être supprimés (sinon la démo n'aurait plus d'entreprise).
      if (PROTEGEES.includes(this.t)) return { data: null, error: null, count: null, status: 204 };
      const touchees = donnees.filter((x) => ligneCorrespond(x, this.filtres));
      const ids = new Set(touchees);
      etat.tables[this.t] = donnees.filter((x) => !ids.has(x));
      cascadeSuppression(this.t, touchees);
      planifierSauvegarde();
      lignes = touchees;
    } else {
      lignes = donnees.filter((x) => ligneCorrespond(x, this.filtres));
    }

    const estLecture = this.op === "select" || this.retourne;
    const total = lignes.length;

    if (!estLecture) return { data: null, error: null, count: null, status: 204 };

    if (this.tris.length) {
      lignes = [...lignes].sort((a, b) => {
        for (const t of this.tris) {
          const c = comparer(valeur(a, t.col), valeur(b, t.col));
          if (c !== 0) return t.asc ? c : -c;
        }
        return 0;
      });
    }
    if (this.plage) lignes = lignes.slice(this.plage[0], this.plage[1] + 1);
    if (this.lim != null) lignes = lignes.slice(0, this.lim);

    if (this.tete) return { data: null, error: null, count: total, status: 200 };

    const sel = analyserSelection(this.selTexte);
    const resultat = lignes.map((l) => clone(appliquerSelection(l, sel, this.t)));

    if (this.unique) {
      if (resultat.length === 1) return { data: resultat[0], error: null, count: this.compte ? total : null, status: 200 };
      if (resultat.length === 0 && this.unique === "maybe") return { data: null, error: null, count: null, status: 200 };
      return { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }, count: null, status: 406 };
    }
    return { data: resultat, error: null, count: this.compte ? total : null, status: 200 };
  }
}

export function from(nomTable) {
  return new Requete(nomTable);
}

// Accès direct (pour les données de départ et les fausses routes /api).
export function lignes(nomTable) {
  return table(nomTable);
}
export function inserer(nomTable, ligne) {
  const l = { id: uuid(), created_at: new Date().toISOString(), ...ligne };
  table(nomTable).push(l);
  return l;
}
export function marquerModifie() {
  planifierSauvegarde();
}
