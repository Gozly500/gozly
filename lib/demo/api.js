import { lignes, metaDemo, marquerModifie, inserer } from "./moteur";
import { ENTREPRISE_DEMO } from "./donnees";

// Fausses routes /api de la démo. Pendant la démo, `fetch("/api/...")` ne part JAMAIS vers le serveur : il est
// intercepté ici et répond avec des données fictives (ou « indisponible dans la démo » pour ce qui exige un vrai service,
// comme Stripe ou Wix). Seules les routes /api sont interceptées ; le reste (polices, images) passe normalement.

const json = (corps, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
const indisponible = (message = "Cette fonction n'est pas disponible dans la démo.") => json({ error: message }, 400);

function lireCorps(init) {
  try {
    return init?.body ? JSON.parse(init.body) : {};
  } catch {
    return {};
  }
}

function integrationsInstallees() {
  const meta = metaDemo();
  const liste = new Set(lignes("integrations_installees").map((r) => r.integration_id));
  for (const c of lignes("stockage_connexions")) liste.add(c.fournisseur === "google" ? "google-drive" : "onedrive");
  if (meta.integrations?.nethris) liste.add("nethris");
  return [...liste];
}

const ROUTES = [
  // ----- Magasin d'intégrations -----
  [/^\/api\/integrations\/installees$/, (_u, init) => {
    const { action, integrationId } = lireCorps(init);
    const table = lignes("integrations_installees");
    if (action === "installer" && integrationId && !table.some((r) => r.integration_id === integrationId)) {
      inserer("integrations_installees", { entreprise_id: ENTREPRISE_DEMO.id, integration_id: integrationId });
    }
    if (action === "retirer") {
      const reste = table.filter((r) => r.integration_id !== integrationId);
      table.length = 0;
      table.push(...reste);
      marquerModifie();
    }
    return json({ installees: integrationsInstallees(), apps: [], configure: true });
  }],
  [/^\/api\/integrations\/app-page$/, () => indisponible()],

  // ----- Nethris (paie) -----
  [/^\/api\/paie\/nethris\/statut/, () => json({ connecte: !!metaDemo().integrations?.nethris, statut: "actif" })],
  [/^\/api\/paie\/nethris\/connecter$/, () => {
    metaDemo().integrations.nethris = true;
    marquerModifie();
    return json({ ok: true });
  }],
  [/^\/api\/paie\/nethris\/deconnecter$/, () => {
    metaDemo().integrations.nethris = false;
    marquerModifie();
    return json({ ok: true });
  }],
  [/^\/api\/paie\/nethris\/exporter$/, () => indisponible("L'envoi vers Nethris est simulé : rien n'a été transmis dans la démo.")],

  // ----- OneDrive / Google Drive -----
  [/^\/api\/stockage\/statut/, () => {
    const connexions = {};
    for (const c of lignes("stockage_connexions")) {
      connexions[c.fournisseur] = { statut: c.statut, email: c.compte_email, exportTemperatures: c.export_temperatures, dernierExport: c.dernier_export_temperatures, erreur: c.derniere_erreur };
    }
    return json({ connexions });
  }],
  [/^\/api\/stockage\/(microsoft|google)\/connecter$/, (u) => {
    const fournisseur = u.match(/stockage\/(microsoft|google)/)[1];
    if (!lignes("stockage_connexions").some((c) => c.fournisseur === fournisseur)) {
      inserer("stockage_connexions", { entreprise_id: ENTREPRISE_DEMO.id, fournisseur, compte_email: "compte@exemple.demo", jeton_actualisation_chiffre: "demo", statut: "connecte", export_temperatures: "aucun", dernier_export_temperatures: null, derniere_erreur: null });
    }
    return json({ ok: true, connecte: true });
  }],
  [/^\/api\/stockage\/deconnecter$/, (_u, init) => {
    const { fournisseur } = lireCorps(init);
    const reste = lignes("stockage_connexions").filter((c) => c.fournisseur !== fournisseur);
    lignes("stockage_connexions").length = 0;
    lignes("stockage_connexions").push(...reste);
    marquerModifie();
    return json({ ok: true });
  }],
  [/^\/api\/stockage\/reglages$/, (_u, init) => {
    const { fournisseur, exportTemperatures } = lireCorps(init);
    const c = lignes("stockage_connexions").find((x) => x.fournisseur === fournisseur);
    if (c && exportTemperatures) c.export_temperatures = exportTemperatures;
    marquerModifie();
    return json({ ok: true });
  }],
  [/^\/api\/stockage\/exporter-maintenant$/, () => json({ ok: true, message: "Export simulé : rien n'a été envoyé dans la démo." })],

  // ----- Services externes : non disponibles dans la démo -----
  [/^\/api\/wix\/statut/, () => json({ connecte: false })],
  [/^\/api\/wix\//, () => indisponible("Wix n'est pas connecté dans la démo.")],
  [/^\/api\/(commandes|ventes\/synchroniser|inventaire\/(synchroniser-wix|pousser-wix|diagnostic-wix)|sonos)/, () => indisponible("Cette synchronisation n'est pas disponible dans la démo.")],
  [/^\/api\/(stripe|factures)/, (u) => (u.includes("factures") ? json({ factures: [] }) : indisponible("Les paiements ne sont pas disponibles dans la démo."))],
  [/^\/api\/(discord|ia|developpeur|admin)\//, () => indisponible()],

  // ----- Notifications et tâches de fond : acceptées sans rien faire -----
  [/^\/api\/pointage\/fermer-oublies/, () => json({ ok: true, fermes: 0 })],
  [/^\/api\/(notifications|rappels|chat|popups|statut)/, () => json({ ok: true, popups: [] })],
];

let installe = false;

export function installerFetchDemo() {
  if (installe || typeof window === "undefined") return;
  installe = true;
  const reel = window.fetch.bind(window);
  window.fetch = (entree, init) => {
    let url = typeof entree === "string" ? entree : entree?.url || "";
    try {
      const u = new URL(url, window.location.origin);
      if (u.origin === window.location.origin) url = u.pathname + u.search;
    } catch {}
    if (url.startsWith("/api/")) {
      const chemin = url.split("?")[0];
      for (const [motif, gerer] of ROUTES) {
        if (motif.test(chemin) || motif.test(url)) {
          try {
            return Promise.resolve(gerer(url, init));
          } catch (e) {
            return Promise.resolve(json({ error: "Erreur dans la démo." }, 500));
          }
        }
      }
      return Promise.resolve(indisponible());
    }
    return reel(entree, init);
  };
}
