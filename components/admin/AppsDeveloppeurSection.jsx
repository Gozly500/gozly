"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ETIQUETTES_STATUT } from "@/lib/appsDeveloppeur";

export default function AppsDeveloppeurSection() {
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [erreur, setErreur] = useState("");
  const [ouverte, setOuverte] = useState(null);

  async function appeler(methode, corps) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/apps-developpeur", {
      method: methode,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Erreur.");
    return data;
  }

  async function charger() {
    setLoading(true);
    setErreur("");
    try {
      const data = await appeler("GET");
      setApps(data.apps || []);
    } catch (e) {
      setErreur(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    charger();
  }, []);

  async function decider(a, statut) {
    let note = "";
    if (statut === "refusee") {
      note = window.prompt("Raison du refus (visible par le développeur) :") ?? null;
      if (note === null) return;
    }
    try {
      await appeler("POST", { id: a.id, statut, note });
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <div>
      <h2>Apps développeur</h2>
      {erreur && <p className="settings-msg err">{erreur}</p>}
      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : apps.length === 0 && !erreur ? (
        <p className="panel-hint">Aucune app soumise.</p>
      ) : (
        <div className="admin-list" style={{ maxWidth: "760px" }}>
          {apps.map((a) => (
            <div key={a.id}>
              <div className="admin-row" style={{ cursor: "pointer" }} onClick={() => setOuverte(ouverte === a.id ? null : a.id)}>
                <div className="admin-row-main">
                  <div className="admin-row-title">{a.nom}</div>
                  <div className="admin-row-sub">
                    {a.proprietaire_id ? `Par ${a.developpeur}` : "Sans propriétaire"} · {ETIQUETTES_STATUT[a.statut]}
                  </div>
                </div>
                <div className="admin-row-controls" onClick={(e) => e.stopPropagation()}>
                  {a.statut !== "approuvee" && (
                    <button className="admin-icon-btn" onClick={() => decider(a, "approuvee")}>
                      Approuver
                    </button>
                  )}
                  {a.statut !== "refusee" && (
                    <button className="admin-icon-btn danger" onClick={() => decider(a, "refusee")}>
                      Refuser
                    </button>
                  )}
                </div>
              </div>
              {ouverte === a.id && (
                <div style={{ padding: "6px 16px 16px", fontSize: "13.5px", color: "var(--text-dim)", display: "grid", gap: "4px" }}>
                  <div>{a.description_courte}</div>
                  {a.description_longue && <div style={{ whiteSpace: "pre-wrap" }}>{a.description_longue}</div>}
                  <div>Service : {a.url_service}</div>
                  <div>Retour de connexion : {a.url_retour}</div>
                  <div>Permissions : {a.permissions?.length ? a.permissions.join(", ") : "aucune"}</div>
                  <div>Support : {a.courriel_support}</div>
                  <div>Confidentialité : {a.url_confidentialite}</div>
                  <div>Prix : {a.payant ? a.prix : "gratuit"}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
