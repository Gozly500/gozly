"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";

export default function TemperatureEmploye() {
  const [equipements, setEquipements] = useState([]);
  const [relevesDuJour, setRelevesDuJour] = useState([]);
  const [loading, setLoading] = useState(true);

  const [equipementId, setEquipementId] = useState("");
  const [temperature, setTemperature] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setLoading(true);
    const res = await employeFetch("/api/employe-app/temperature");
    const data = await res.json();
    setEquipements(data.equipements || []);
    setRelevesDuJour(data.relevesDuJour || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!equipementId || temperature === "") return;

    setSaving(true);
    setMsg(null);

    const res = await employeFetch("/api/employe-app/temperature", {
      method: "POST",
      body: JSON.stringify({ equipementId, temperature, note }),
    });

    setSaving(false);

    if (!res.ok) {
      setMsg({ type: "err", text: "L'enregistrement a échoué. Réessaie." });
      return;
    }

    setTemperature("");
    setNote("");
    setMsg({ type: "ok", text: "Relevé enregistré !" });
    setTimeout(() => setMsg(null), 3000);
    charger();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Températures</h2>
      <p className="panel-hint">Note la température des frigos/congélateurs.</p>

      {equipements.length === 0 ? (
        <p className="chat-empty">Aucun équipement à relever pour l'instant.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Équipement</label>
            <select value={equipementId} onChange={(e) => setEquipementId(e.target.value)} required>
              <option value="">Choisir...</option>
              {equipements.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Température (°C)</label>
            <input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Note (optionnel)</label>
            <input type="text" placeholder="Action corrective si hors norme" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="submit-wrap">
            <button type="submit" className="submit-btn" disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
          {msg && (
            <p className={`settings-msg ${msg.type}`} style={{ textAlign: "center" }}>
              {msg.text}
            </p>
          )}
        </form>
      )}

      {relevesDuJour.length > 0 && (
        <>
          <div className="settings-divider">Relevés d'aujourd'hui</div>
          <div className="admin-list" style={{ marginBottom: "20px" }}>
            {relevesDuJour.map((r) => {
              const eq = equipements.find((e) => e.id === r.equipement_id);
              return (
                <div className="admin-row" key={r.id}>
                  <div className="admin-row-main">
                    <div className="admin-row-title">
                      {eq?.nom || "?"} - {r.conforme ? "✓" : "⚠️"} {r.temperature}°C
                    </div>
                    <div className="admin-row-sub">
                      {r.releve_par} ·{" "}
                      {new Date(r.created_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
