import crypto from "crypto";
import { droitsDe, aAuMoinsUnDroit } from "./iaModules.js";

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
  // Jeton d'accès OAuth expiré (1 h) : 401, l'assistant le renouvelle alors tout seul avec son jeton de renouvellement.
  if (cle.oauth && cle.expire_le && new Date(cle.expire_le) < new Date()) return { erreur: { status: 401, message: "Jeton expiré." } };

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

// `module` : le module dont dépend l'outil ("base" = utile dès qu'un module est accessible). `ecriture` : l'outil modifie des données.
export const OUTILS = [
  {
    nom: "lister_employes",
    module: "base",
    ecriture: false,
    description: "Liste les employés de l'entreprise (id, nom, rôle, succursales). Ne contient jamais de salaire, de NIP ni de coordonnées.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    nom: "lister_emplacements",
    module: "base",
    ecriture: false,
    description: "Liste les succursales (emplacements) de l'entreprise.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    nom: "lire_horaire",
    module: "horaire",
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
    module: "horaire",
    ecriture: false,
    description: "Heures réellement pointées par les employés sur une période (total par employé et détail par pointage).",
    inputSchema: SCHEMA_PLAGE,
  },
  {
    nom: "creer_quart_brouillon",
    module: "horaire",
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
    module: "horaire",
    ecriture: true,
    description: "Supprime un quart qui est encore en brouillon. Un quart déjà publié ne peut pas être supprimé par l'IA.",
    inputSchema: { type: "object", properties: { quart_id: { type: "string" } }, required: ["quart_id"] },
  },
  {
    nom: "lister_categories_planning",
    module: "planning",
    ecriture: false,
    description: "Liste les catégories de tâches du module Planning, avec les tâches modèles de chacune.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    nom: "lire_planning",
    module: "planning",
    ecriture: false,
    description: "Lit les tâches du module Planning (tâches par catégorie et par journée) sur une période.",
    inputSchema: {
      type: "object",
      properties: { ...SCHEMA_PLAGE.properties, emplacement_id: { type: "string", description: "Optionnel : limiter à une succursale." } },
      required: SCHEMA_PLAGE.required,
    },
  },
  {
    nom: "creer_taches_planning",
    module: "planning",
    ecriture: true,
    description:
      "Ajoute des tâches à une journée du Planning. ATTENTION : dans Planning il n'y a pas de brouillon, les employés voient ces tâches tout de suite dans leur app (aucune notification n'est envoyée). Lis d'abord lire_planning : les tâches identiques déjà présentes sont ignorées.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "AAAA-MM-JJ." },
        emplacement_id: { type: "string", description: "Succursale (voir lister_emplacements). Optionnel s'il n'y en a qu'une." },
        taches: {
          type: "array",
          description: "1 à 50 tâches.",
          items: {
            type: "object",
            properties: {
              texte: { type: "string", description: "Texte de la tâche (200 caractères max)." },
              categorie_id: { type: "string", description: "Optionnel : catégorie (voir lister_categories_planning)." },
            },
            required: ["texte"],
          },
        },
      },
      required: ["date", "taches"],
    },
  },
  {
    nom: "supprimer_tache_planning",
    module: "planning",
    ecriture: true,
    description: "Supprime une tâche du Planning créée par l'IA. Une tâche ajoutée par un humain ne peut pas être supprimée par l'IA.",
    inputSchema: { type: "object", properties: { tache_id: { type: "string" } }, required: ["tache_id"] },
  },
  {
    nom: "lire_inventaire",
    module: "inventaire",
    ecriture: false,
    description: "Lit les produits de l'inventaire (nom, SKU, quantité, seuil d'alerte). Lecture seulement.",
    inputSchema: {
      type: "object",
      properties: {
        recherche: { type: "string", description: "Optionnel : texte à chercher dans le nom ou le SKU." },
        stock_bas: { type: "boolean", description: "Optionnel : seulement les produits à ou sous leur seuil d'alerte." },
      },
    },
  },
  {
    nom: "lire_ventes",
    module: "ventes",
    ecriture: false,
    description: "Lit le journal des ventes d'une période (montants, source, description) avec les totaux par source. Lecture seulement.",
    inputSchema: SCHEMA_PLAGE,
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

async function listerCategoriesPlanning(service, cle) {
  const [{ data: cats }, { data: modeles }] = await Promise.all([
    service.from("categories").select("id, nom").eq("entreprise_id", cle.entreprise_id).order("nom"),
    service.from("taches_modeles").select("categorie_id, nom").eq("entreprise_id", cle.entreprise_id).order("nom"),
  ]);
  return {
    categories: (cats || []).map((c) => ({
      id: c.id,
      nom: c.nom,
      modeles: (modeles || []).filter((m) => m.categorie_id === c.id).map((m) => m.nom),
    })),
  };
}

async function lirePlanning(service, cle, args) {
  const { debut, fin } = plage(args);
  let q = service
    .from("taches")
    .select("id, date, texte, terminee, categorie_id, emplacement_id, source")
    .eq("entreprise_id", cle.entreprise_id)
    .gte("date", debut)
    .lte("date", fin)
    .order("date")
    .order("created_at")
    .limit(1000);
  if (args.emplacement_id) q = q.eq("emplacement_id", args.emplacement_id);
  const { data, error } = await q;
  if (error) throw new Error("Lecture du planning impossible.");

  const { data: cats } = await service.from("categories").select("id, nom").eq("entreprise_id", cle.entreprise_id);
  const noms = new Map((cats || []).map((c) => [c.id, c.nom]));
  return {
    taches: (data || []).map((t) => ({
      id: t.id,
      date: t.date,
      texte: t.texte,
      terminee: !!t.terminee,
      categorie: noms.get(t.categorie_id) || null,
      emplacement_id: t.emplacement_id || null,
      creee_par_ia: t.source === "ia",
    })),
  };
}

async function creerTachesPlanning(service, cle, args) {
  if (!dateValide(args.date)) throw new Erreur("La date doit être au format AAAA-MM-JJ.");
  const liste = Array.isArray(args.taches) ? args.taches : [];
  if (liste.length === 0 || liste.length > 50) throw new Erreur("Donne entre 1 et 50 tâches.");
  const propres = liste.map((t) => ({ texte: typeof t?.texte === "string" ? t.texte.trim() : "", categorie_id: t?.categorie_id || null }));
  if (propres.some((t) => !t.texte || t.texte.length > 200)) throw new Erreur("Chaque tâche doit avoir un texte de 1 à 200 caractères.");

  // Succursale : celle donnée, sinon l'unique de l'entreprise.
  const { data: lieux } = await service.from("emplacements").select("id").eq("entreprise_id", cle.entreprise_id);
  let emplacementId = null;
  if (args.emplacement_id) {
    if (!(lieux || []).some((l) => l.id === args.emplacement_id)) throw new Erreur("Succursale introuvable dans cette entreprise.");
    emplacementId = args.emplacement_id;
  } else if ((lieux || []).length === 1) {
    emplacementId = lieux[0].id;
  } else if ((lieux || []).length > 1) {
    throw new Erreur("Cette entreprise a plusieurs succursales : précise emplacement_id (voir lister_emplacements).");
  }

  // Catégories : doivent appartenir à l'entreprise.
  const idsCat = [...new Set(propres.map((t) => t.categorie_id).filter(Boolean))];
  if (idsCat.length) {
    const { data: cats } = await service.from("categories").select("id").eq("entreprise_id", cle.entreprise_id).in("id", idsCat);
    const valides = new Set((cats || []).map((c) => c.id));
    if (idsCat.some((id) => !valides.has(id))) throw new Erreur("Une catégorie est introuvable dans cette entreprise (voir lister_categories_planning).");
  }

  // Doublons : une tâche identique (même texte, catégorie, succursale, jour) déjà présente est ignorée.
  let existantes = service.from("taches").select("texte, categorie_id, emplacement_id").eq("entreprise_id", cle.entreprise_id).eq("date", args.date);
  if (emplacementId) existantes = existantes.eq("emplacement_id", emplacementId);
  const { data: deja } = await existantes;
  const cle_ = (t) => `${String(t.texte).trim().toLowerCase()}|${t.categorie_id || ""}`;
  const presentes = new Set((deja || []).map(cle_));
  const aCreer = [];
  const ignorees = [];
  for (const t of propres) {
    const k = cle_(t);
    if (presentes.has(k)) ignorees.push(t.texte);
    else {
      presentes.add(k);
      aCreer.push({ entreprise_id: cle.entreprise_id, categorie_id: t.categorie_id, date: args.date, texte: t.texte, emplacement_id: emplacementId, source: "ia" });
    }
  }

  if (aCreer.length > 0) {
    const { error } = await service.from("taches").insert(aCreer);
    if (error) throw new Error("Impossible de créer les tâches.");
  }
  return {
    ok: true,
    creees: aCreer.length,
    ignorees_car_deja_presentes: ignorees,
    rappel: "Ces tâches sont visibles des employés tout de suite (le Planning n'a pas de brouillon). Aucune notification n'a été envoyée.",
  };
}

async function supprimerTachePlanning(service, cle, args) {
  const { data: tache } = await service.from("taches").select("id, source").eq("id", args.tache_id).eq("entreprise_id", cle.entreprise_id).maybeSingle();
  if (!tache) throw new Erreur("Tâche introuvable dans cette entreprise.");
  if (tache.source !== "ia") throw new Erreur("Cette tâche n'a pas été créée par l'IA : un humain doit la supprimer dans Gozly.");
  const { error } = await service.from("taches").delete().eq("id", tache.id).eq("source", "ia");
  if (error) throw new Error("Impossible de supprimer la tâche.");
  return { ok: true };
}

async function lireInventaire(service, cle, args) {
  const { data, error } = await service
    .from("produits_inventaire")
    .select("id, nom, sku, quantite, seuil_alerte")
    .eq("entreprise_id", cle.entreprise_id)
    .order("nom")
    .limit(500);
  if (error) throw new Error("Lecture de l'inventaire impossible.");
  const recherche = typeof args.recherche === "string" ? args.recherche.trim().toLowerCase() : "";
  let produits = (data || []).map((p) => ({
    id: p.id,
    nom: p.nom,
    sku: p.sku || null,
    quantite: p.quantite,
    seuil_alerte: p.seuil_alerte,
    stock_bas: p.seuil_alerte > 0 && p.quantite <= p.seuil_alerte,
  }));
  if (recherche) produits = produits.filter((p) => p.nom.toLowerCase().includes(recherche) || (p.sku || "").toLowerCase().includes(recherche));
  if (args.stock_bas === true) produits = produits.filter((p) => p.stock_bas);
  return { produits };
}

async function lireVentes(service, cle, args) {
  const { debut, fin } = plage(args);
  const { data, error } = await service
    .from("ventes")
    .select("id, source, montant, date, description")
    .eq("entreprise_id", cle.entreprise_id)
    .gte("date", debut)
    .lte("date", fin)
    .order("date")
    .limit(2000);
  if (error) throw new Error("Lecture des ventes impossible.");
  const ventes = (data || []).map((v) => ({ id: v.id, source: v.source, montant: Number(v.montant), date: v.date, description: v.description || null }));
  const parSource = {};
  let total = 0;
  for (const v of ventes) {
    parSource[v.source] = Math.round(((parSource[v.source] || 0) + v.montant) * 100) / 100;
    total += v.montant;
  }
  return { total: Math.round(total * 100) / 100, par_source: parSource, ventes };
}

const EXECUTEURS = {
  lister_employes: listerEmployes,
  lister_emplacements: listerEmplacements,
  lire_horaire: lireHoraire,
  lire_heures_pointees: lireHeures,
  creer_quart_brouillon: creerQuartBrouillon,
  supprimer_quart_brouillon: supprimerQuartBrouillon,
  lister_categories_planning: listerCategoriesPlanning,
  lire_planning: lirePlanning,
  creer_taches_planning: creerTachesPlanning,
  supprimer_tache_planning: supprimerTachePlanning,
  lire_inventaire: lireInventaire,
  lire_ventes: lireVentes,
};

// Un outil est offert selon les droits de la connexion sur son module : lecture (ou écriture) pour lire, écriture pour modifier.
function disponible(outil, droits) {
  if (outil.module === "base") return aAuMoinsUnDroit(droits);
  const niveau = droits[outil.module];
  return outil.ecriture ? niveau === "ecriture" : niveau === "lecture" || niveau === "ecriture";
}

export function outilsPour(cle) {
  const droits = droitsDe(cle);
  return OUTILS.filter((o) => disponible(o, droits)).map(({ nom, description, inputSchema }) => ({ name: nom, description, inputSchema }));
}

// Exécute un outil pour une clé. Retourne { contenu, erreur } (jamais d'exception : les erreurs sont renvoyées à l'IA).
export async function appelerOutil(service, cle, nom, args) {
  const outil = OUTILS.find((o) => o.nom === nom);
  if (!outil) return { erreur: "Outil inconnu." };
  const droits = droitsDe(cle);
  if (!disponible(outil, droits)) {
    const lectureSeule = outil.ecriture && (droits[outil.module] === "lecture");
    const refus = lectureSeule ? "Cette connexion est en lecture seule pour ce module : elle ne peut pas modifier de données." : "Cette connexion n'a pas accès à ce module.";
    await journaliser(service, cle, nom, "Refusé : " + refus, false);
    return { erreur: refus };
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
  if (nom === "lire_horaire" || nom === "lire_heures_pointees" || nom === "lire_planning" || nom === "lire_ventes") return `${a.debut} -> ${a.fin}`;
  if (nom === "creer_quart_brouillon") return `${a.date} ${a.heure_debut}-${a.heure_fin}`;
  if (nom === "supprimer_quart_brouillon") return `quart ${a.quart_id}`;
  if (nom === "creer_taches_planning") return `${a.date} : ${Array.isArray(a.taches) ? a.taches.length : 0} tâche(s)`;
  if (nom === "supprimer_tache_planning") return `tâche ${a.tache_id}`;
  if (nom === "lire_inventaire") return a.recherche ? `recherche « ${String(a.recherche).slice(0, 40)} »` : a.stock_bas ? "stock bas" : "";
  return "";
}
