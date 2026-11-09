import crypto from "crypto";

// Connexion d'un assistant IA (ChatGPT, Claude...) à une entreprise Gozly, via le protocole MCP (voir app/api/ia/mcp/route.js).
// Règle de base : l'IA lit, et au plus elle crée des BROUILLONS d'horaire. Elle ne publie jamais : c'est un humain qui publie.

export const PREFIXE_CLE = "gozly_ia_";
const LIMITE_PAR_MINUTE = 60;
const MAX_JOURS = 62;

export function hashCle(cle) {
  return crypto.createHash("sha256").update(cle).digest("hex");
}

export function genererCle() {
  const cle = PREFIXE_CLE + crypto.randomBytes(24).toString("base64url");
  return { cle, hash: hashCle(cle), prefixe: cle.slice(0, PREFIXE_CLE.length + 6) };
}

// Retrouve la clé (non révoquée) à partir de la requête. Retourne { cle } ou { erreur: { status, message } }.
export async function authentifierCle(service, jeton) {
  if (!jeton || !jeton.startsWith(PREFIXE_CLE)) return { erreur: { status: 401, message: "Clé d'accès manquante ou invalide." } };
  const { data: cle } = await service.from("ia_cles").select("*").eq("cle_hash", hashCle(jeton)).eq("revoquee", false).maybeSingle();
  if (!cle) return { erreur: { status: 401, message: "Clé d'accès manquante ou invalide." } };

  const depuis = new Date(Date.now() - 60_000).toISOString();
  const { count } = await service.from("ia_journal").select("id", { count: "exact", head: true }).eq("cle_id", cle.id).gte("created_at", depuis);
  if ((count || 0) >= LIMITE_PAR_MINUTE) return { erreur: { status: 429, message: "Trop de requêtes : réessaie dans une minute." } };

  // On ne réécrit « dernière utilisation » qu'une fois par minute (inutile à chaque appel).
  if (!cle.derniere_utilisation || Date.now() - new Date(cle.derniere_utilisation).getTime() > 60_000) {
    await service.from("ia_cles").update({ derniere_utilisation: new Date().toISOString() }).eq("id", cle.id);
  }
  return { cle };
}

async function journaliser(service, cle, outil, resume, ok) {
  await service
    .from("ia_journal")
    .insert({ entreprise_id: cle.entreprise_id, cle_id: cle.id, outil, resume: String(resume || "").slice(0, 300), ok })
    .then(() => {}, () => {});
}

// ---------- Validation ----------

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

function dateValide(s) {
  return typeof s === "string" && RE_DATE.test(s) && !Number.isNaN(new Date(s + "T00:00:00Z").getTime());
}

function jours(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}

function plage(args) {
  if (!dateValide(args.debut) || !dateValide(args.fin)) throw new Erreur("Les dates doivent être au format AAAA-MM-JJ (ex: 2026-11-16).");
  const n = jours(args.debut, args.fin);
  if (n < 0) throw new Erreur("La date de fin doit être après la date de début.");
  if (n > MAX_JOURS) throw new Erreur(`La période est limitée à ${MAX_JOURS} jours.`);
  return { debut: args.debut, fin: args.fin };
}

class Erreur extends Error {}

const enMinutes = (h) => {
  const [hh, mm] = String(h).slice(0, 5).split(":").map(Number);
  return hh * 60 + mm;
};

function dateQuebec(iso) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

// ---------- Outils ----------

const SCHEMA_PLAGE = {
  type: "object",
  properties: {
    debut: { type: "string", description: "Date de début, format AAAA-MM-JJ." },
    fin: { type: "string", description: "Date de fin (incluse), format AAAA-MM-JJ. Maximum 62 jours après le début." },
  },
  required: ["debut", "fin"],
};

export const OUTILS = [
  {
    nom: "lister_employes",
    ecriture: false,
    description: "Liste les employés de l'entreprise (id, nom, rôle, succursales). Ne contient jamais de salaire, de NIP ni de coordonnées.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    nom: "lister_emplacements",
    ecriture: false,
    description: "Liste les succursales (emplacements) de l'entreprise.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    nom: "lire_horaire",
    ecriture: false,
    description:
      "Lit les quarts de travail d'une période. Chaque quart indique s'il est publié (visible des employés) ou en brouillon (invisible des employés).",
    inputSchema: {
      type: "object",
      properties: { ...SCHEMA_PLAGE.properties, emplacement_id: { type: "string", description: "Optionnel : limiter à une succursale." } },
      required: SCHEMA_PLAGE.required,
    },
  },
  {
    nom: "lire_heures_pointees",
    ecriture: false,
    description: "Heures réellement pointées par les employés sur une période (total par employé et détail par pointage).",
    inputSchema: SCHEMA_PLAGE,
  },
  {
    nom: "creer_quart_brouillon",
    ecriture: true,
    description:
      "Crée un quart de travail en BROUILLON. Les employés ne le voient pas et ne sont pas notifiés : un humain doit relire et publier l'horaire dans Gozly. Vérifie d'abord avec lire_horaire pour éviter les doublons.",
    inputSchema: {
      type: "object",
      properties: {
        employe_id: { type: "string", description: "Id d'un employé (voir lister_employes)." },
        date: { type: "string", description: "AAAA-MM-JJ." },
        heure_debut: { type: "string", description: "HH:MM (24 h)." },
        heure_fin: { type: "string", description: "HH:MM (24 h). Une heure de fin plus petite que le début veut dire que le quart passe minuit." },
        poste: { type: "string", description: "Optionnel : poste (ex: cuisine, salle)." },
        emplacement_id: { type: "string", description: "Optionnel : succursale (voir lister_emplacements)." },
      },
      required: ["employe_id", "date", "heure_debut", "heure_fin"],
    },
  },
  {
    nom: "supprimer_quart_brouillon",
    ecriture: true,
    description: "Supprime un quart qui est encore en brouillon. Un quart déjà publié ne peut pas être supprimé par l'IA.",
    inputSchema: { type: "object", properties: { quart_id: { type: "string" } }, required: ["quart_id"] },
  },
];

async function listerEmployes(service, cle) {
  const { data: employes } = await service.from("employes").select("id, nom, role").eq("entreprise_id", cle.entreprise_id).order("nom");
  const ids = (employes || []).map((e) => e.id);
  const liens = ids.length ? (await service.from("employe_emplacements").select("employe_id, emplacement_id").in("employe_id", ids)).data || [] : [];
  return {
    employes: (employes || []).map((e) => ({
      id: e.id,
      nom: e.nom,
      role: e.role || null,
      emplacements: liens.filter((l) => l.employe_id === e.id).map((l) => l.emplacement_id),
    })),
  };
}

async function listerEmplacements(service, cle) {
  const { data } = await service.from("emplacements").select("id, nom").eq("entreprise_id", cle.entreprise_id).order("nom");
  return { emplacements: data || [] };
}

async function lireHoraire(service, cle, args) {
  const { debut, fin } = plage(args);
  let q = service
    .from("planning_quarts")
    .select("id, employe_id, date, heure_debut, heure_fin, poste, emplacement_id, publie")
    .eq("entreprise_id", cle.entreprise_id)
    .gte("date", debut)
    .lte("date", fin)
    .order("date")
    .order("heure_debut");
  if (args.emplacement_id) q = q.eq("emplacement_id", args.emplacement_id);
  const { data: quarts, error } = await q;
  if (error) throw new Error("Lecture de l'horaire impossible.");

  const { data: employes } = await service.from("employes").select("id, nom").eq("entreprise_id", cle.entreprise_id);
  const noms = new Map((employes || []).map((e) => [e.id, e.nom]));
  return {
    quarts: (quarts || []).map((x) => ({
      id: x.id,
      employe_id: x.employe_id,
      employe: noms.get(x.employe_id) || null,
      date: x.date,
      heure_debut: String(x.heure_debut).slice(0, 5),
      heure_fin: String(x.heure_fin).slice(0, 5),
      poste: x.poste || null,
      emplacement_id: x.emplacement_id || null,
      statut: x.publie ? "publié" : "brouillon",
    })),
  };
}

async function lireHeures(service, cle, args) {
  const { debut, fin } = plage(args);
  // Marge d'un jour de chaque côté, puis filtre sur la date du Québec (évite les décalages de fuseau).
  const avant = new Date(new Date(debut + "T00:00:00Z").getTime() - 86400000).toISOString();
  const apres = new Date(new Date(fin + "T00:00:00Z").getTime() + 2 * 86400000).toISOString();
  const { data, error } = await service
    .from("pointages")
    .select("employe_id, entree, sortie")
    .eq("entreprise_id", cle.entreprise_id)
    .gte("entree", avant)
    .lte("entree", apres)
    .order("entree");
  if (error) throw new Error("Lecture des pointages impossible.");

  const { data: employes } = await service.from("employes").select("id, nom").eq("entreprise_id", cle.entreprise_id);
  const noms = new Map((employes || []).map((e) => [e.id, e.nom]));

  const parEmploye = new Map();
  for (const p of data || []) {
    const jour = dateQuebec(p.entree);
    if (jour < debut || jour > fin) continue;
    const heures = p.sortie ? Math.round(((new Date(p.sortie) - new Date(p.entree)) / 3600000) * 100) / 100 : null;
    const cur = parEmploye.get(p.employe_id) || { employe_id: p.employe_id, employe: noms.get(p.employe_id) || null, total_heures: 0, pointages: [] };
    cur.total_heures = Math.round((cur.total_heures + (heures || 0)) * 100) / 100;
    cur.pointages.push({ date: jour, entree: p.entree, sortie: p.sortie, heures, en_cours: !p.sortie });
    parEmploye.set(p.employe_id, cur);
  }
  return { employes: [...parEmploye.values()] };
}

async function creerQuartBrouillon(service, cle, args) {
  const { employe_id, date, heure_debut, heure_fin } = args;
  if (!dateValide(date)) throw new Erreur("La date doit être au format AAAA-MM-JJ.");
  if (!RE_HEURE.test(String(heure_debut)) || !RE_HEURE.test(String(heure_fin))) throw new Erreur("Les heures doivent être au format HH:MM (24 h).");
  if (heure_debut === heure_fin) throw new Erreur("Le début et la fin du quart sont identiques.");

  const { data: employe } = await service.from("employes").select("id, nom").eq("id", employe_id).eq("entreprise_id", cle.entreprise_id).maybeSingle();
  if (!employe) throw new Erreur("Employé introuvable dans cette entreprise.");

  let emplacementId = null;
  if (args.emplacement_id) {
    const { data: lieu } = await service.from("emplacements").select("id").eq("id", args.emplacement_id).eq("entreprise_id", cle.entreprise_id).maybeSingle();
    if (!lieu) throw new Erreur("Succursale introuvable dans cette entreprise.");
    emplacementId = lieu.id;
  }

  // Avertit (sans bloquer) si l'employé a déjà un quart qui chevauche ce jour-là.
  const { data: memeJour } = await service.from("planning_quarts").select("id, heure_debut, heure_fin, publie").eq("entreprise_id", cle.entreprise_id).eq("employe_id", employe.id).eq("date", date);
  const d = enMinutes(heure_debut);
  const f = enMinutes(heure_fin);
  const chevauche = (memeJour || []).filter((x) => {
    const xd = enMinutes(x.heure_debut);
    const xf = enMinutes(x.heure_fin);
    return d < xf && xd < f;
  });

  const poste = typeof args.poste === "string" && args.poste.trim() ? args.poste.trim().slice(0, 60) : null;
  const { data: quart, error } = await service
    .from("planning_quarts")
    .insert({ entreprise_id: cle.entreprise_id, employe_id: employe.id, date, heure_debut, heure_fin, poste, emplacement_id: emplacementId, publie: false })
    .select("id")
    .single();
  if (error) throw new Error("Impossible de créer le quart.");

  return {
    ok: true,
    quart_id: quart.id,
    statut: "brouillon",
    employe: employe.nom,
    avertissement: chevauche.length ? `Cet employé a déjà ${chevauche.length} quart(s) qui se chevauche(nt) ce jour-là (ids : ${chevauche.map((x) => x.id).join(", ")}).` : undefined,
    rappel: "Ce quart est un brouillon : les employés ne le voient pas. Un humain doit publier l'horaire dans Gozly.",
  };
}

async function supprimerQuartBrouillon(service, cle, args) {
  const { data: quart } = await service.from("planning_quarts").select("id, publie").eq("id", args.quart_id).eq("entreprise_id", cle.entreprise_id).maybeSingle();
  if (!quart) throw new Erreur("Quart introuvable dans cette entreprise.");
  if (quart.publie) throw new Erreur("Ce quart est publié : l'IA ne peut pas le supprimer. Un humain doit le faire dans Gozly.");
  const { error } = await service.from("planning_quarts").delete().eq("id", quart.id).eq("publie", false);
  if (error) throw new Error("Impossible de supprimer le quart.");
  return { ok: true };
}

const EXECUTEURS = {
  lister_employes: listerEmployes,
  lister_emplacements: listerEmplacements,
  lire_horaire: lireHoraire,
  lire_heures_pointees: lireHeures,
  creer_quart_brouillon: creerQuartBrouillon,
  supprimer_quart_brouillon: supprimerQuartBrouillon,
};

export function outilsPour(cle) {
  return OUTILS.filter((o) => !o.ecriture || cle.ecriture).map(({ nom, description, inputSchema }) => ({ name: nom, description, inputSchema }));
}

// Exécute un outil pour une clé. Retourne { contenu, erreur } (jamais d'exception : les erreurs sont renvoyées à l'IA).
export async function appelerOutil(service, cle, nom, args) {
  const outil = OUTILS.find((o) => o.nom === nom);
  if (!outil) return { erreur: "Outil inconnu." };
  if (outil.ecriture && !cle.ecriture) {
    await journaliser(service, cle, nom, "Refusé : clé en lecture seule", false);
    return { erreur: "Cette clé est en lecture seule : elle ne peut pas créer de brouillon." };
  }
  try {
    const contenu = await EXECUTEURS[nom](service, cle, args && typeof args === "object" ? args : {});
    await journaliser(service, cle, nom, resumeAppel(nom, args), true);
    return { contenu };
  } catch (err) {
    const visible = err instanceof Erreur ? err.message : "Une erreur est survenue.";
    if (!(err instanceof Erreur)) console.error("Erreur outil IA:", nom, err?.message || err);
    await journaliser(service, cle, nom, `${resumeAppel(nom, args)} -> ${visible}`, false);
    return { erreur: visible };
  }
}

function resumeAppel(nom, args = {}) {
  const a = args || {};
  if (nom === "lire_horaire" || nom === "lire_heures_pointees") return `${a.debut} -> ${a.fin}`;
  if (nom === "creer_quart_brouillon") return `${a.date} ${a.heure_debut}-${a.heure_fin}`;
  if (nom === "supprimer_quart_brouillon") return `quart ${a.quart_id}`;
  return "";
}
