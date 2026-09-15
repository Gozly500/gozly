"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { IconIntegration } from "@/components/icons/GozlyIcons";
import { SERVICES_PAIE } from "@/lib/servicesPaie";

// Regroupe les intégrations par catégorie pour les retrouver plus
// facilement au fur et à mesure qu'on en ajoute (chaque catégorie est un
// tiroir dépliable - voir CATEGORIES ci-dessous). "wix" et "nethris" sont
// les seules branchées pour l'instant, le reste s'affiche en "bientôt
// disponible" pour montrer ce qui s'en vient.
const SERVICES_VENTES = [
  { id: "wix", label: "Wix", disponible: true },
  { id: "shopify", label: "Shopify", disponible: false },
];

const CATEGORIES = [
  { id: "ventes", label: "Ventes & Inventaire", services: SERVICES_VENTES },
  { id: "paie", label: "Paie", services: SERVICES_PAIE },
];

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function IntegrationsSection() {
  const [categoriesOuvertes, setCategoriesOuvertes] = useState({});

  const [statut, setStatut] = useState("chargement"); // "chargement" | "deconnecte" | "en_attente" | "connecte"
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const pollRef = useRef(null);

  const [nethrisStatut, setNethrisStatut] = useState("chargement"); // "chargement" | "deconnecte" | "connecte"
  const [nethrisBusy, setNethrisBusy] = useState(false);
  const [nethrisMsg, setNethrisMsg] = useState(null);
  const [nethrisModalOuvert, setNethrisModalOuvert] = useState(false);
  const [nethrisForm, setNethrisForm] = useState({ codeEntreprise: "", codeUtilisateur: "", motDePasse: "" });

  useEffect(() => {
    charger();
    chargerNethris();
    return () => clearInterval(pollRef.current);
  }, []);

  function toggleCategorie(id) {
    setCategoriesOuvertes((cur) => ({ ...cur, [id]: !cur[id] }));
  }

  async function chargerNethris() {
    try {
      const res = await fetch("/api/paie/nethris/statut", { headers: await authHeaders() });
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
        body: JSON.stringify(nethrisForm),
      });
      const data = await res.json();

      if (!res.ok) {
        setNethrisMsg({ type: "err", text: data.error || "La connexion a échoué." });
      } else {
        setNethrisStatut("connecte");
        setNethrisForm({ codeEntreprise: "", codeUtilisateur: "", motDePasse: "" });
        setNethrisModalOuvert(false);
      }
    } catch {
      setNethrisMsg({ type: "err", text: "La connexion a échoué." });
    }
    setNethrisBusy(false);
  }

  async function handleDeconnecterNethris() {
    setNethrisBusy(true);
    setNethrisMsg(null);

    try {
      await fetch("/api/paie/nethris/deconnecter", { method: "POST", headers: await authHeaders() });
      setNethrisStatut("deconnecte");
      setNethrisMsg({ type: "ok", text: "Nethris est déconnecté." });
    } catch {
      setNethrisMsg({ type: "err", text: "La déconnexion a échoué." });
    }
    setNethrisBusy(false);
  }

  async function charger() {
    try {
      const res = await fetch("/api/wix/statut", { headers: await authHeaders() });
      const data = await res.json();
      setStatut(data.connecte ? "connecte" : data.enAttente ? "en_attente" : "deconnecte");
      if (data.enAttente) demarrerSurveillance();
    } catch {
      setStatut("deconnecte");
    }
  }

  function demarrerSurveillance() {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/wix/statut", { headers: await authHeaders() });
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
      const res = await fetch("/api/wix/connecter", { method: "POST", headers: await authHeaders() });
      const data = await res.json();

      if (!res.ok || !data.lienInstallation) {
        setMsg({ type: "err", text: data.error || "La connexion a échoué." });
        setBusy(false);
        return;
      }

      window.open(data.lienInstallation, "_blank", "noopener,noreferrer");
      setStatut("en_attente");
      demarrerSurveillance();
    } catch {
      setMsg({ type: "err", text: "La connexion a échoué." });
    }
    setBusy(false);
  }

  async function handleDeconnecter() {
    setBusy(true);
    setMsg(null);
    clearInterval(pollRef.current);

    try {
      await fetch("/api/wix/deconnecter", { method: "POST", headers: await authHeaders() });
      setStatut("deconnecte");
      setMsg({ type: "ok", text: "Wix est déconnecté." });
    } catch {
      setMsg({ type: "err", text: "La déconnexion a échoué." });
    }
    setBusy(false);
  }

  function renderWix() {
    return (
      <div className="integration-item">
        <div className="integration-header open">
          <span className="ih-label">
            Wix — Inventaire
            {statut === "connecte" && (
              <span className="forfait-badge" style={{ padding: "3px 10px", fontSize: "11.5px" }}>
                <IconIntegration className="gozly-icon" style={{ width: "13px", height: "13px" }} /> Connecté
              </span>
            )}
          </span>
        </div>

        <div className="integration-body">
          {statut === "chargement" && <p className="section-hint">Vérification du statut...</p>}

          {statut === "deconnecte" && (
            <>
              <p className="section-hint">
                Connecte ton compte Wix pour lire l'inventaire de ta boutique Wix Stores directement dans Gozly.
              </p>
              <button type="button" className="submit-btn" onClick={handleConnecter} disabled={busy}>
                {busy ? "..." : "Connecter Wix"}
              </button>
            </>
          )}

          {statut === "en_attente" && (
            <>
              <p className="section-hint">
                En attente de la fin de l'installation sur Wix... Reviens ici une fois l'installation terminée,
                cette page se met à jour automatiquement.
              </p>
              <button type="button" className="admin-icon-btn" onClick={handleConnecter} disabled={busy}>
                {busy ? "..." : "Réessayer / ouvrir le lien à nouveau"}
              </button>
              <button type="button" className="admin-icon-btn danger" onClick={handleDeconnecter} disabled={busy}>
                Annuler
              </button>
            </>
          )}

          {statut === "connecte" && (
            <>
              <p className="section-hint">Ton inventaire Wix est connecté.</p>
              <button type="button" className="admin-icon-btn danger" onClick={handleDeconnecter} disabled={busy}>
                {busy ? "..." : "Déconnecter"}
              </button>
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
            Nethris
            {nethrisStatut === "connecte" && (
              <span className="forfait-badge" style={{ padding: "3px 10px", fontSize: "11.5px" }}>
                <IconIntegration className="gozly-icon" style={{ width: "13px", height: "13px" }} /> Connecté
              </span>
            )}
          </span>
        </div>

        <div className="integration-body">
          {nethrisStatut === "chargement" && <p className="section-hint">Vérification du statut...</p>}

          {nethrisStatut === "deconnecte" && (
            <>
              <p className="section-hint">Connecte ton utilisateur de services Nethris pour envoyer la feuille de temps automatiquement.</p>
              <button type="button" className="submit-btn" onClick={() => setNethrisModalOuvert(true)}>
                Connecter Nethris
              </button>
            </>
          )}

          {nethrisStatut === "connecte" && (
            <>
              <p className="section-hint">Nethris est connecté.</p>
              <button type="button" className="admin-icon-btn danger" onClick={handleDeconnecterNethris} disabled={nethrisBusy}>
                {nethrisBusy ? "..." : "Déconnecter"}
              </button>
            </>
          )}

          {nethrisMsg && <p className={`settings-msg ${nethrisMsg.type}`}>{nethrisMsg.text}</p>}
        </div>
      </div>
    );
  }

  function renderBientotDisponible(service) {
    return (
      <div className="integration-item" key={service.id}>
        <div className="integration-header disabled">
          <span className="ih-label">{service.label}</span>
          <span className="ih-hint">Bientôt disponible</span>
        </div>
      </div>
    );
  }

  function renderService(service) {
    if (!service.disponible) return renderBientotDisponible(service);
    if (service.id === "wix") return <div key={service.id}>{renderWix()}</div>;
    if (service.id === "nethris") return <div key={service.id}>{renderNethris()}</div>;
    return renderBientotDisponible(service);
  }

  return (
    <div>
      <h2>Intégrations</h2>
      <p className="panel-hint">Connecte des services externes pour synchroniser leurs données avec Gozly.</p>

      <div className="integration-list">
        {CATEGORIES.map((cat) => {
          const ouverte = !!categoriesOuvertes[cat.id];
          return (
            <div className="integration-item" key={cat.id}>
              <button type="button" className={`integration-header${ouverte ? " open" : ""}`} onClick={() => toggleCategorie(cat.id)}>
                <span className="ih-label">{cat.label}</span>
                <span className="ih-arrow">▾</span>
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
              <h3>Connecter Nethris</h3>
              <button className="admin-icon-btn" onClick={() => setNethrisModalOuvert(false)}>
                Fermer
              </button>
            </div>
            <form onSubmit={handleConnecterNethris}>
              <p className="section-hint">
                Entre les identifiants de l'utilisateur de services créé dans ta Suite Internet Nethris
                (Administration → Ajout d'un utilisateur).
              </p>
              <div className="field-row">
                <div className="field">
                  <label>Code d'entreprise</label>
                  <input
                    type="text"
                    value={nethrisForm.codeEntreprise}
                    onChange={(e) => setNethrisForm((f) => ({ ...f, codeEntreprise: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>Code d'utilisateur</label>
                  <input
                    type="text"
                    value={nethrisForm.codeUtilisateur}
                    onChange={(e) => setNethrisForm((f) => ({ ...f, codeUtilisateur: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label>Mot de passe</label>
                <input
                  type="password"
                  value={nethrisForm.motDePasse}
                  onChange={(e) => setNethrisForm((f) => ({ ...f, motDePasse: e.target.value }))}
                  required
                />
              </div>
              <button type="submit" className="submit-btn" disabled={nethrisBusy} style={{ marginTop: "10px", width: "100%" }}>
                {nethrisBusy ? "..." : "Connecter Nethris"}
              </button>
              {nethrisMsg && <p className={`settings-msg ${nethrisMsg.type}`}>{nethrisMsg.text}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
