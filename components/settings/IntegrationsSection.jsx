"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function IntegrationsSection() {
  const [statut, setStatut] = useState("chargement"); // "chargement" | "deconnecte" | "en_attente" | "connecte"
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    charger();
    return () => clearInterval(pollRef.current);
  }, []);

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

  return (
    <div>
      <h2>Intégrations</h2>
      <p className="panel-hint">Connecte des services externes pour synchroniser leurs données avec Gozly.</p>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      <div className="integration-list">
        <div className="integration-item">
          <div className="integration-header open">
            <span className="ih-label">
              Wix — Inventaire
              {statut === "connecte" && (
                <span className="forfait-badge" style={{ padding: "3px 10px", fontSize: "11.5px" }}>
                  🔌 Connecté
                </span>
              )}
            </span>
          </div>

          <div className="integration-body">
            {statut === "chargement" && <p className="section-hint">Vérification du statut...</p>}

            {statut === "deconnecte" && (
              <>
                <p className="section-hint">
                  Connecte ton compte Wix pour lire l'inventaire de ta boutique Wix Stores directement dans
                  Gozly.
                </p>
                <button type="button" className="submit-btn" onClick={handleConnecter} disabled={busy}>
                  {busy ? "..." : "Connecter Wix"}
                </button>
              </>
            )}

            {statut === "en_attente" && (
              <>
                <p className="section-hint">
                  En attente de la fin de l'installation sur Wix... Reviens ici une fois l'installation
                  terminée, cette page se met à jour automatiquement.
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
          </div>
        </div>
      </div>
    </div>
  );
}
