"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const ETIQUETTES = { en_attente: "En attente", approuvee: "Approuvée", refusee: "Refusée" };

export default function DemandesDeveloppeurSection() {
  const [loading, setLoading] = useState(true);
  const [demandes, setDemandes] = useState([]);
  const [erreur, setErreur] = useState("");

  async function appeler(methode, corps) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/developpeurs", {
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
      setDemandes(data.demandes || []);
    } catch (e) {
      setErreur(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    charger();
  }, []);

  async function decider(id, statut) {
    try {
      await appeler("POST", { id, statut });
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  return (
    <div>
      <h2>Demandes développeur</h2>
      {erreur && <p className="settings-msg err">{erreur}</p>}
      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : demandes.length === 0 && !erreur ? (
        <p className="panel-hint">Aucune demande.</p>
      ) : (
        <div className="admin-list" style={{ maxWidth: "720px" }}>
          {demandes.map((d) => (
            <div className="admin-row" key={d.id}>
              <div className="admin-row-main">
                <div className="admin-row-title">{d.nom || d.courriel || "Compte"}</div>
                <div className="admin-row-sub">
                  {d.courriel} · {new Date(d.created_at).toLocaleDateString("fr-CA")} · {ETIQUETTES[d.statut]}
                </div>
              </div>
              <div className="admin-row-controls">
                {d.statut !== "approuvee" && (
                  <button className="admin-icon-btn" onClick={() => decider(d.id, "approuvee")}>
                    Approuver
                  </button>
                )}
                {d.statut !== "refusee" && (
                  <button className="admin-icon-btn danger" onClick={() => decider(d.id, "refusee")}>
                    Refuser
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
