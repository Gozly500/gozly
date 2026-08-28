"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { PERIODES } from "@/lib/temperature";

export default function TemperatureEmploye() {
  const [equipements, setEquipements] = useState([]);
  const [relevesDuJour, setRelevesDuJour] = useState([]);
  const [creneau, setCreneau] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
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
    setCreneau(data.creneauActuel || null);

    const seed = {};
    for (const r of data.relevesDuJour || []) {
      if (r.periode === data.creneauActuel?.periode) seed[r.equipement_id] = String(r.temperature);
    }
    setDrafts(seed);
    setLoading(false);
  }

  function releveExistant(equipementId, periode) {
    return relevesDuJour.find((r) => r.equipement_id === equipementId && r.periode === periode);
  }

  function estModifie() {
    return equipements.some((eq) => {
      const existant = releveExistant(eq.id, creneau?.periode);
      const draftValue = drafts[eq.id] ?? "";
      const existantValue = existant ? String(existant.temperature) : "";
      return draftValue !== existantValue;
    });
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);

    const aEnvoyer = equipements.filter((eq) => {
      const existant = releveExistant(eq.id, creneau?.periode);
      const draftValue = drafts[eq.id] ?? "";
      const existantValue = existant ? String(existant.temperature) : "";
      return draftValue !== "" && draftValue !== existantValue;
    });

    const resultats = await Promise.all(
      aEnvoyer.map((eq) =>
        employeFetch("/api/employe-app/temperature", {
          method: "POST",
          body: JSON.stringify({ equipementId: eq.id, temperature: drafts[eq.id] }),
        })
      )
    );

    setSaving(false);

    if (resultats.some((r) => !r.ok)) {
      setMsg({ type: "err", text: "Certains relevés n'ont pas pu être enregistrés. Réessaie." });
      charger();
      return;
    }

    setMsg({ type: "ok", text: "Relevés enregistrés !" });
    setTimeout(() => setMsg(null), 3000);
    charger();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  if (equipements.length === 0) {
    return (
      <div>
        <h2>Températures</h2>
        <p className="chat-empty">Aucun équipement à relever pour l'instant.</p>
      </div>
    );
  }

  const periodeLabel = PERIODES.find((p) => p.id === creneau?.periode)?.label || "";
  const autrePeriode = creneau?.periode === "am" ? "pm" : "am";

  const categories = [];
  const parCategorie = new Map();
  for (const eq of equipements) {
    const cle = eq.categorie?.id || "sans-categorie";
    if (!parCategorie.has(cle)) {
      parCategorie.set(cle, []);
      categories.push({ id: cle, nom: eq.categorie?.nom || "Autres" });
    }
    parCategorie.get(cle).push(eq);
  }

  return (
    <div>
      <h2>Températures</h2>
      <p className="panel-hint">Créneau actuel : {periodeLabel}. Une fenêtre manquée ne revient pas - inutile de la rattraper.</p>

      {categories.map((cat) => (
        <div className="planning-day" key={cat.id} style={{ marginBottom: "14px" }}>
          <div className="planning-day-head">
            <span className="planning-day-title">{cat.nom}</span>
          </div>
          {parCategorie.get(cat.id).map((eq) => {
            const autreReleve = releveExistant(eq.id, autrePeriode);
            return (
              <div key={eq.id} className="field-row" style={{ padding: "10px 14px", alignItems: "center", margin: 0 }}>
                <div style={{ flex: 1, fontSize: "13.5px", fontWeight: 600 }}>{eq.nom}</div>
                <div style={{ fontSize: "12.5px", color: "var(--text-dim)", minWidth: "70px" }}>
                  {autrePeriode === "am" ? "AM" : "PM"}: {autreReleve ? `${autreReleve.conforme ? "✓" : "⚠️"} ${autreReleve.temperature}°C` : "—"}
                </div>
                <input
                  type="number"
                  step="0.1"
                  placeholder={`${periodeLabel.slice(0, 2)} °C`}
                  style={{ width: "90px" }}
                  value={drafts[eq.id] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [eq.id]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
      ))}

      <div className="submit-wrap" style={{ marginTop: "16px" }}>
        <button type="button" className="submit-btn" onClick={handleSave} disabled={saving || !estModifie()}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
      {msg && (
        <p className={`settings-msg ${msg.type}`} style={{ textAlign: "center" }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
