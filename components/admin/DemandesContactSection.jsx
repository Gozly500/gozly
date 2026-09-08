"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const FILTRES = [
  { id: "en_attente", label: "En attente" },
  { id: "tous", label: "Tous" },
  { id: "traites", label: "Traités" },
];

export default function DemandesContactSection() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [filtre, setFiltre] = useState("en_attente");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("messages_contact").select("*").order("created_at", { ascending: false });
    setMessages(data || []);
    setLoading(false);
  }

  async function toggleTraite(msg) {
    await supabase.from("messages_contact").update({ traite: !msg.traite }).eq("id", msg.id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  const messagesFiltres = messages.filter((m) => {
    if (filtre === "en_attente") return !m.traite;
    if (filtre === "traites") return m.traite;
    return true;
  });

  return (
    <div>
      <h2>Demandes</h2>
      <p className="panel-hint">Suppressions de compte, sites vitrine, et messages du formulaire de contact.</p>

      <div className="settings-nav" style={{ flexDirection: "row", marginBottom: "20px", width: "fit-content" }}>
        {FILTRES.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`settings-nav-item${filtre === f.id ? " active" : ""}`}
            onClick={() => setFiltre(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="admin-list" style={{ maxWidth: "720px" }}>
        {messagesFiltres.map((m) => (
          <div className="admin-row" key={m.id} style={{ alignItems: "flex-start" }}>
            <div className="admin-row-main">
              <div className="admin-row-title">{m.objet || "Sans objet"}</div>
              <div className="admin-row-sub">
                {m.nom ? `${m.nom} · ` : ""}
                {m.courriel} · {new Date(m.created_at).toLocaleDateString("fr-CA")}
              </div>
              {m.message && (
                <p style={{ marginTop: "8px", fontSize: "13.5px", color: "var(--text-dim)", whiteSpace: "pre-wrap" }}>
                  {m.message}
                </p>
              )}
            </div>
            <div className="admin-row-controls">
              <button className="admin-icon-btn" onClick={() => toggleTraite(m)}>
                {m.traite ? "Remettre en attente" : "Marquer traité"}
              </button>
            </div>
          </div>
        ))}
        {messagesFiltres.length === 0 && <div className="admin-empty">Aucune demande.</div>}
      </div>
    </div>
  );
}
