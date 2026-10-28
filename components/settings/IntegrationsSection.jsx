"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { IconIntegration } from "@/components/icons/GozlyIcons";
import { SERVICES_PAIE } from "@/lib/servicesPaie";
import { IconFlecheBas } from "@/components/icons/Pictogrammes";
import DiagnosticWixModal from "@/components/inventaire/DiagnosticWixModal";
import { useT } from "@/components/LangProvider";

// Regroupe les intégrations par catégorie pour les retrouver plus
// facilement au fur et à mesure qu'on en ajoute (chaque catégorie est un
// tiroir dépliable - voir CATEGORIES ci-dessous). "wix" et "nethris" sont
// les seules branchées pour l'instant, le reste s'affiche en "bientôt
// disponible" pour montrer ce qui s'en vient.
const SERVICES_VENTES = [
  { id: "wix", label: "Wix", disponible: true },
  { id: "shopify", label: "Shopify", disponible: false },
];

const SERVICES_STOCKAGE = [
  { id: "onedrive", label: "OneDrive", disponible: true },
  { id: "google-drive", label: "Google Drive", disponible: true },
];

const STOCKAGES = {
  microsoft: { nom: "OneDrive" },
  google: { nom: "Google Drive" },
};

const FREQUENCES_EXPORT = [
  { id: "aucun", label: "Désactivé" },
  { id: "hebdo", label: "Chaque semaine" },
  { id: "mensuel", label: "Chaque mois" },
];

const CATEGORIES = [
  { id: "ventes", label: "Ventes & Inventaire", services: SERVICES_VENTES },
  { id: "stockage", label: "Stockage de fichiers", services: SERVICES_STOCKAGE },
  { id: "paie", label: "Paie", services: SERVICES_PAIE },
];

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function IntegrationsSection({ entrepriseId }) {
  const [supportWixOuvert, setSupportWixOuvert] = useState(false); // « Outils de support » de Wix (caché tant qu'on n'en a pas besoin)
  const [diagWixOuvert, setDiagWixOuvert] = useState(false);
  const { t } = useT();
  const [categoriesOuvertes, setCategoriesOuvertes] = useState({});

  const [statut, setStatut] = useState("chargement"); // "chargement" | "deconnecte" | "en_attente" | "connecte"
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const pollRef = useRef(null);
  // Autres dashboards de l'utilisateur qui ont déjà Wix connecté (même site, plusieurs succursales).
  const [autresDashboards, setAutresDashboards] = useState([]);

  const [nethrisStatut, setNethrisStatut] = useState("chargement"); // "chargement" | "deconnecte" | "connecte"
  const [nethrisBusy, setNethrisBusy] = useState(false);
  const [nethrisMsg, setNethrisMsg] = useState(null);
  const [nethrisModalOuvert, setNethrisModalOuvert] = useState(false);
  const [nethrisForm, setNethrisForm] = useState({ codeEntreprise: "", codeUtilisateur: "", motDePasse: "" });

  // Stockage (OneDrive = "microsoft", Google Drive = "google") : etat = "chargement" | "deconnecte" | "connecte" | "a_reconnecter"
  const [stock, setStock] = useState({ microsoft: { etat: "chargement" }, google: { etat: "chargement" } });
  const [stockBusy, setStockBusy] = useState({});
  const [stockMsg, setStockMsg] = useState({});

  useEffect(() => {
    if (!entrepriseId) return;
    charger();
    chargerNethris();
    chargerStockage();
    return () => clearInterval(pollRef.current);
  }, [entrepriseId]);

  // Retour de la page de connexion Microsoft/Google (?stockage=ok|annule|erreur&fournisseur=...) : on rouvre la bonne catégorie et on dit comment ça s'est passé.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultat = params.get("stockage");
    if (!resultat) return;
    const fournisseur = STOCKAGES[params.get("fournisseur")] ? params.get("fournisseur") : "microsoft";
    const nom = STOCKAGES[fournisseur].nom;
    setCategoriesOuvertes((cur) => ({ ...cur, stockage: true }));
    definirMsgStockage(
      fournisseur,
      resultat === "ok"
        ? { type: "ok", text: t("{nom} est connecté.", { nom }) }
        : resultat === "annule"
        ? { type: "err", text: t("Connexion à {nom} annulée.", { nom }) }
        : { type: "err", text: t("La connexion a échoué.") }
    );
    params.delete("fournisseur");
    params.delete("stockage");
    params.delete("onglet");
    const reste = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (reste ? `?${reste}` : ""));
  }, []);

  function definirMsgStockage(fournisseur, msg) {
    setStockMsg((cur) => ({ ...cur, [fournisseur]: msg }));
  }

  function definirOccupeStockage(fournisseur, valeur) {
    setStockBusy((cur) => ({ ...cur, [fournisseur]: valeur }));
  }

  async function chargerStockage() {
    try {
      const res = await fetch(`/api/stockage/statut?entrepriseId=${entrepriseId}`, { headers: await authHeaders() });
      const data = await res.json();
      const suivant = {};
      for (const fournisseur of Object.keys(STOCKAGES)) {
        const c = data.connexions?.[fournisseur];
        suivant[fournisseur] = c
          ? {
              etat: c.statut === "connecte" ? "connecte" : "a_reconnecter",
              email: c.email,
              frequence: c.exportTemperatures,
              dernierExport: c.dernierExport,
              erreur: c.erreur,
            }
          : { etat: "deconnecte" };
      }
      setStock(suivant);
    } catch {
      setStock({ microsoft: { etat: "deconnecte" }, google: { etat: "deconnecte" } });
    }
  }

  async function handleConnecterStockage(fournisseur) {
    definirOccupeStockage(fournisseur, true);
    definirMsgStockage(fournisseur, null);
    try {
      const res = await fetch(`/api/stockage/${fournisseur}/connecter`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId }),
      });
      const data = await res.json();
      if (!res.ok || !data.lien) {
        definirMsgStockage(fournisseur, { type: "err", text: data.error || t("La connexion a échoué.") });
        definirOccupeStockage(fournisseur, false);
        return;
      }
      window.location.href = data.lien;
    } catch {
      definirMsgStockage(fournisseur, { type: "err", text: t("La connexion a échoué.") });
      definirOccupeStockage(fournisseur, false);
    }
  }

  async function handleFrequenceStockage(fournisseur, frequence) {
    const avant = stock[fournisseur]?.frequence;
    setStock((cur) => ({ ...cur, [fournisseur]: { ...cur[fournisseur], frequence } }));
    definirMsgStockage(fournisseur, null);
    try {
      const res = await fetch("/api/stockage/reglages", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId, fournisseur, exportTemperatures: frequence }),
      });
      if (!res.ok) throw new Error();
      definirMsgStockage(fournisseur, { type: "ok", text: t("Préférence enregistrée.") });
    } catch {
      setStock((cur) => ({ ...cur, [fournisseur]: { ...cur[fournisseur], frequence: avant } }));
      definirMsgStockage(fournisseur, { type: "err", text: t("L'enregistrement a échoué.") });
    }
  }

  async function handleExporterMaintenant(fournisseur) {
    const nom = STOCKAGES[fournisseur].nom;
    definirOccupeStockage(fournisseur, true);
    definirMsgStockage(fournisseur, null);
    try {
      const res = await fetch("/api/stockage/exporter-maintenant", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId, fournisseur }),
      });
      const data = await res.json();
      if (!res.ok) {
        definirMsgStockage(fournisseur, { type: "err", text: data.error || t("L'export a échoué.") });
        chargerStockage();
      } else if (data.releves === 0) {
        definirMsgStockage(fournisseur, { type: "ok", text: t("Aucun relevé de température à exporter pour les 30 derniers jours.") });
      } else {
        definirMsgStockage(fournisseur, {
          type: "ok",
          text: t("Export terminé : {n} relevé(s) déposé(s) dans {nom} (dossier Gozly > Temperatures).", { n: data.releves, nom }),
        });
      }
    } catch {
      definirMsgStockage(fournisseur, { type: "err", text: t("L'export a échoué.") });
    }
    definirOccupeStockage(fournisseur, false);
  }

  async function handleDeconnecterStockage(fournisseur) {
    definirOccupeStockage(fournisseur, true);
    definirMsgStockage(fournisseur, null);
    try {
      await fetch("/api/stockage/deconnecter", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId, fournisseur }),
      });
      setStock((cur) => ({ ...cur, [fournisseur]: { etat: "deconnecte" } }));
      definirMsgStockage(fournisseur, { type: "ok", text: t("{nom} est déconnecté.", { nom: STOCKAGES[fournisseur].nom }) });
    } catch {
      definirMsgStockage(fournisseur, { type: "err", text: t("La déconnexion a échoué.") });
    }
    definirOccupeStockage(fournisseur, false);
  }

  function toggleCategorie(id) {
    setCategoriesOuvertes((cur) => ({ ...cur, [id]: !cur[id] }));
  }

  async function chargerNethris() {
    try {
      const res = await fetch(`/api/paie/nethris/statut?entrepriseId=${entrepriseId}`, { headers: await authHeaders() });
      const data = await res.json();
      setNethrisStatut(data.connecte ? "connecte" : "deconnecte");
    } catch {
      setNethrisStatut("deconnecte");
    }
  }

  async function handleConnecterNethris(e) {
    e.preventDefault();
    setNethrisBusy(true);
    setNethrisMsg(null);

    try {
      const res = await fetch("/api/paie/nethris/connecter", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ ...nethrisForm, entrepriseId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNethrisMsg({ type: "err", text: data.error || t("La connexion a échoué.") });
      } else {
        setNethrisStatut("connecte");
        setNethrisForm({ codeEntreprise: "", codeUtilisateur: "", motDePasse: "" });
        setNethrisModalOuvert(false);
      }
    } catch {
      setNethrisMsg({ type: "err", text: t("La connexion a échoué.") });
    }
    setNethrisBusy(false);
  }

  async function handleDeconnecterNethris() {
    setNethrisBusy(true);
    setNethrisMsg(null);

    try {
      await fetch("/api/paie/nethris/deconnecter", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId }),
      });
      setNethrisStatut("deconnecte");
      setNethrisMsg({ type: "ok", text: t("Nethris est déconnecté.") });
    } catch {
      setNethrisMsg({ type: "err", text: t("La déconnexion a échoué.") });
    }
    setNethrisBusy(false);
  }

  async function charger() {
    try {
      const res = await fetch(`/api/wix/statut?entrepriseId=${entrepriseId}`, { headers: await authHeaders() });
      const data = await res.json();
      setStatut(data.connecte ? "connecte" : data.enAttente ? "en_attente" : "deconnecte");
      if (data.enAttente) demarrerSurveillance();
      if (!data.connecte && !data.enAttente) chargerAutresDashboards();
    } catch {
      setStatut("deconnecte");
    }
  }

  async function chargerAutresDashboards() {
    try {
      const res = await fetch("/api/wix/autres-connexions", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId }),
      });
      const data = await res.json();
      setAutresDashboards(data.entreprises || []);
    } catch {
      setAutresDashboards([]);
    }
  }

  // Réutilise l'installation Wix d'un autre dashboard (même site Wix, autre succursale).
  async function handleUtiliserMemeConnexion(depuisEntrepriseId) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/wix/copier-connexion", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId, depuisEntrepriseId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ type: "err", text: `${data.error || "La connexion a échoué."}${data.detail ? ` [${data.detail}]` : ""}` });
      } else {
        setStatut("connecte");
      }
    } catch {
      setMsg({ type: "err", text: t("La connexion a échoué.") });
    }
    setBusy(false);
  }

  function demarrerSurveillance() {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/wix/statut?entrepriseId=${entrepriseId}`, { headers: await authHeaders() });
      const data = await res.json();
      if (data.connecte) {
        setStatut("connecte");
        clearInterval(pollRef.current);
      }
    }, 4000);
  }

  async function handleConnecter() {
    setBusy(true);
    setMsg(null);

    try {
      const res = await fetch("/api/wix/connecter", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId }),
      });
      const data = await res.json();

      if (!res.ok || !data.lienInstallation) {
        setMsg({ type: "err", text: data.error || t("La connexion a échoué.") });
        setBusy(false);
        return;
      }

      window.open(data.lienInstallation, "_blank", "noopener,noreferrer");
      setStatut("en_attente");
      demarrerSurveillance();
    } catch {
      setMsg({ type: "err", text: t("La connexion a échoué.") });
    }
    setBusy(false);
  }

  async function handleDeconnecter() {
    setBusy(true);
    setMsg(null);
    clearInterval(pollRef.current);

    try {
      await fetch("/api/wix/deconnecter", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId }),
      });
      setStatut("deconnecte");
      setMsg({ type: "ok", text: t("Wix est déconnecté.") });
    } catch {
      setMsg({ type: "err", text: t("La déconnexion a échoué.") });
    }
    setBusy(false);
  }

  function renderWix() {
    return (
      <div className="integration-item">
        <div className="integration-header open">
          <span className="ih-label">
            {t("Wix — Inventaire")}
            {statut === "connecte" && (
              <span className="forfait-badge" style={{ padding: "3px 10px", fontSize: "11.5px" }}>
                <IconIntegration className="gozly-icon" style={{ width: "13px", height: "13px" }} />{" "}{t("Connecté")}
              </span>
            )}
          </span>
        </div>

        <div className="integration-body">
          {statut === "chargement" && <p className="section-hint">{t("Vérification du statut...")}</p>}

          {statut === "deconnecte" && (
            <>
              <p className="section-hint">
                {t("Connecte ton compte Wix pour lire l'inventaire de ta boutique Wix Stores directement dans Gozly.")}
              </p>
              <button type="button" className="submit-btn" onClick={handleConnecter} disabled={busy}>
                {busy ? "..." : t("Connecter Wix")}
              </button>

              {autresDashboards.length > 0 && (
                <div style={{ marginTop: "18px" }}>
                  <p className="section-hint">
                    {t("Ce site Wix est déjà connecté à un autre de tes dashboards (ex: l'autre succursale)? Réutilise la même connexion, sans réinstaller l'app.")}
                  </p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {autresDashboards.map((e) => (
                      <button key={e.id} type="button" className="admin-icon-btn" onClick={() => handleUtiliserMemeConnexion(e.id)} disabled={busy}>
                        {t("Utiliser la connexion de «")}{" "}{e.nom} »
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {statut === "en_attente" && (
            <>
              <p className="section-hint">
                {t("En attente de la fin de l'installation sur Wix... Reviens ici une fois l'installation terminée, cette page se met à jour automatiquement.")}
              </p>
              <button type="button" className="admin-icon-btn" onClick={handleConnecter} disabled={busy}>
                {busy ? "..." : t("Réessayer / ouvrir le lien à nouveau")}
              </button>
              <button type="button" className="admin-icon-btn danger" onClick={handleDeconnecter} disabled={busy}>
                {t("Annuler")}
              </button>
            </>
          )}

          {statut === "connecte" && (
            <>
              <p className="section-hint">
                {t("Ton site Wix est connecté. Si le même site alimente plusieurs dashboards (une succursale chacun), choisis la succursale de celui-ci dans Personnalisation → Commandes en ligne.")}
              </p>
              <button type="button" className="admin-icon-btn danger" onClick={handleDeconnecter} disabled={busy}>
                {busy ? "..." : t("Déconnecter")}
              </button>

              <div style={{ marginTop: "18px" }}>
                <button type="button" className="outils-support-toggle" aria-expanded={supportWixOuvert} onClick={() => setSupportWixOuvert((v) => !v)}>
                  {t("Outils de support")}
                  <span className={`param-nav-fleche${supportWixOuvert ? " ouvert" : ""}`}>
                    <IconFlecheBas className="gozly-icon-inline" />
                  </span>
                </button>
                {supportWixOuvert && (
                  <div className="outils-support-corps">
                    <p className="section-hint">{t("À utiliser seulement si un produit Wix manque ou si la synchronisation se comporte bizarrement, de préférence avec le support Gozly.")}</p>
                    <button type="button" className="admin-icon-btn" onClick={() => setDiagWixOuvert(true)}>
                      {t("Diagnostic Wix")}
                    </button>
                  </div>
                )}
              </div>
              {diagWixOuvert && <DiagnosticWixModal entrepriseId={entrepriseId} onClose={() => setDiagWixOuvert(false)} />}
            </>
          )}

          {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
        </div>
      </div>
    );
  }

  function renderNethris() {
    return (
      <div className="integration-item">
        <div className="integration-header open">
          <span className="ih-label">
            {t("Nethris")}
            {nethrisStatut === "connecte" && (
              <span className="forfait-badge" style={{ padding: "3px 10px", fontSize: "11.5px" }}>
                <IconIntegration className="gozly-icon" style={{ width: "13px", height: "13px" }} />{" "}{t("Connecté")}
              </span>
            )}
          </span>
        </div>

        <div className="integration-body">
          {nethrisStatut === "chargement" && <p className="section-hint">{t("Vérification du statut...")}</p>}

          {nethrisStatut === "deconnecte" && (
            <>
              <p className="section-hint">{t("Connecte ton utilisateur de services Nethris pour envoyer la feuille de temps automatiquement.")}</p>
              <button type="button" className="submit-btn" onClick={() => setNethrisModalOuvert(true)}>
                {t("Connecter Nethris")}
              </button>
            </>
          )}

          {nethrisStatut === "connecte" && (
            <>
              <p className="section-hint">{t("Nethris est connecté.")}</p>
              <button type="button" className="admin-icon-btn danger" onClick={handleDeconnecterNethris} disabled={nethrisBusy}>
                {nethrisBusy ? "..." : t("Déconnecter")}
              </button>
            </>
          )}

          {nethrisMsg && <p className={`settings-msg ${nethrisMsg.type}`}>{nethrisMsg.text}</p>}
        </div>
      </div>
    );
  }

  function renderStockage(fournisseur) {
    const nom = STOCKAGES[fournisseur].nom;
    const od = stock[fournisseur] || { etat: "chargement" };
    const occupe = !!stockBusy[fournisseur];
    const msg = stockMsg[fournisseur];
    return (
      <div className="integration-item">
        <div className="integration-header open">
          <span className="ih-label">
            {nom}
            {od.etat === "connecte" && (
              <span className="forfait-badge" style={{ padding: "3px 10px", fontSize: "11.5px" }}>
                <IconIntegration className="gozly-icon" style={{ width: "13px", height: "13px" }} />{" "}{t("Connecté")}
              </span>
            )}
          </span>
        </div>

        <div className="integration-body">
          {od.etat === "chargement" && <p className="section-hint">{t("Vérification du statut...")}</p>}

          {od.etat === "deconnecte" && (
            <>
              <p className="section-hint">
                {t("Connecte ton {nom} pour que Gozly y dépose automatiquement tes fiches de température (un fichier Excel par semaine ou par mois, dans un dossier « Gozly »). Tu gardes ainsi tes fiches même après leur suppression de Gozly.", { nom })}
              </p>
              <button type="button" className="submit-btn" onClick={() => handleConnecterStockage(fournisseur)} disabled={occupe}>
                {occupe ? "..." : t("Connecter {nom}", { nom })}
              </button>
            </>
          )}

          {od.etat === "a_reconnecter" && (
            <>
              <p className="section-hint">{od.erreur || t("La connexion à {nom} a expiré : reconnecte ton compte.", { nom })}</p>
              <button type="button" className="submit-btn" onClick={() => handleConnecterStockage(fournisseur)} disabled={occupe}>
                {occupe ? "..." : t("Reconnecter {nom}", { nom })}
              </button>{" "}
              <button type="button" className="admin-icon-btn danger" onClick={() => handleDeconnecterStockage(fournisseur)} disabled={occupe}>
                {t("Déconnecter")}
              </button>
            </>
          )}

          {od.etat === "connecte" && (
            <>
              {od.email && <p className="section-hint">{t("Compte : {email}", { email: od.email })}</p>}

              <p className="section-hint" style={{ marginBottom: "6px" }}>{t("Export automatique des fiches de température")}</p>
              <div className="avatar-segment">
                {FREQUENCES_EXPORT.map((f) => (
                  <button key={f.id} type="button" className={od.frequence === f.id ? "actif" : ""} onClick={() => handleFrequenceStockage(fournisseur, f.id)}>
                    {t(f.label)}
                  </button>
                ))}
              </div>
              <p className="section-hint" style={{ marginTop: "10px" }}>
                {t("Les fiches de la semaine (ou du mois) passée sont déposées dans le dossier « Gozly » de ton {nom}, avant leur suppression de Gozly.", { nom })}
                {od.dernierExport ? ` ${t("Dernier export : {date}", { date: od.dernierExport })}` : ""}
              </p>
              {od.erreur && <p className="settings-msg err">{od.erreur}</p>}

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                <button type="button" className="admin-icon-btn" onClick={() => handleExporterMaintenant(fournisseur)} disabled={occupe}>
                  {occupe ? "..." : t("Exporter maintenant (30 derniers jours)")}
                </button>
                <button type="button" className="admin-icon-btn danger" onClick={() => handleDeconnecterStockage(fournisseur)} disabled={occupe}>
                  {t("Déconnecter")}
                </button>
              </div>
              <p className="section-hint" style={{ marginTop: "8px" }}>{t("Les fichiers déjà déposés restent dans ton {nom} si tu te déconnectes.", { nom })}</p>
            </>
          )}

          {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
        </div>
      </div>
    );
  }

  function renderBientotDisponible(service) {
    return (
      <div className="integration-item" key={service.id}>
        <div className="integration-header disabled">
          <span className="ih-label">{t(service.label)}</span>
          <span className="ih-hint">{t("Bientôt disponible")}</span>
        </div>
      </div>
    );
  }

  function renderService(service) {
    if (!service.disponible) return renderBientotDisponible(service);
    if (service.id === "wix") return <div key={service.id}>{renderWix()}</div>;
    if (service.id === "nethris") return <div key={service.id}>{renderNethris()}</div>;
    if (service.id === "onedrive") return <div key={service.id}>{renderStockage("microsoft")}</div>;
    if (service.id === "google-drive") return <div key={service.id}>{renderStockage("google")}</div>;
    return renderBientotDisponible(service);
  }

  return (
    <div>
      <h2>{t("Intégrations")}</h2>
      <p className="panel-hint">{t("Connecte des services externes pour synchroniser leurs données avec Gozly.")}</p>

      <div className="integration-list">
        {CATEGORIES.map((cat) => {
          const ouverte = !!categoriesOuvertes[cat.id];
          return (
            <div className="integration-item" key={cat.id}>
              <button type="button" className={`integration-header${ouverte ? " open" : ""}`} onClick={() => toggleCategorie(cat.id)}>
                <span className="ih-label">{t(cat.label)}</span>
                <span className="ih-arrow"><IconFlecheBas className="gozly-icon-inline" /></span>
              </button>

              {ouverte && (
                <div className="integration-body">
                  <div className="integration-list" style={{ marginTop: "14px" }}>
                    {cat.services.map((service) => renderService(service))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {nethrisModalOuvert && (
        <div className="modal-overlay" onClick={() => setNethrisModalOuvert(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("Connecter Nethris")}</h3>
              <button className="admin-icon-btn" onClick={() => setNethrisModalOuvert(false)}>
                {t("Fermer")}
              </button>
            </div>
            <form onSubmit={handleConnecterNethris}>
              <p className="section-hint">
                {t("Entre les identifiants de l'utilisateur de services créé dans ta Suite Internet Nethris (Administration → Ajout d'un utilisateur).")}
              </p>
              <div className="field-row">
                <div className="field">
                  <label>{t("Code d'entreprise")}</label>
                  <input
                    type="text"
                    value={nethrisForm.codeEntreprise}
                    onChange={(e) => setNethrisForm((f) => ({ ...f, codeEntreprise: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>{t("Code d'utilisateur")}</label>
                  <input
                    type="text"
                    value={nethrisForm.codeUtilisateur}
                    onChange={(e) => setNethrisForm((f) => ({ ...f, codeUtilisateur: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label>{t("Mot de passe")}</label>
                <input
                  type="password"
                  value={nethrisForm.motDePasse}
                  onChange={(e) => setNethrisForm((f) => ({ ...f, motDePasse: e.target.value }))}
                  required
                />
              </div>
              <button type="submit" className="submit-btn" disabled={nethrisBusy} style={{ marginTop: "10px", width: "100%" }}>
                {nethrisBusy ? "..." : t("Connecter Nethris")}
              </button>
              {nethrisMsg && <p className={`settings-msg ${nethrisMsg.type}`}>{nethrisMsg.text}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
