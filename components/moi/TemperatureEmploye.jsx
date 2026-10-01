"use client";

import { useEffect, useRef, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";
import TemperatureInput from "@/components/TemperatureInput";

export default function TemperatureEmploye() {
  const { t } = useLangue();
  const [equipements, setEquipements] = useState([]);
  const [relevesDuJour, setRelevesDuJour] = useState([]);
  const [creneau, setCreneau] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const relevesRef = useRef([]);

  useEffect(() => {
    charger();
    // Rafraîchit les relevés des collègues sans écraser ce qui est en train d'être saisi.
    const id = setInterval(() => charger({ silencieux: true }), 30000);
    return () => clearInterval(id);
  }, []);

  async function charger({ silencieux = false } = {}) {
    if (!silencieux) setLoading(true);
    const res = await employeFetch("/api/employe-app/temperature");
    const data = await res.json();
    setEquipements(data.equipements || []);
    setRelevesDuJour(data.relevesDuJour || []);
    setCreneau(data.creneauActuel || null);

    const seed = {};
    for (const r of data.relevesDuJour || []) {
      if (r.periode === data.creneauActuel?.periode) seed[r.equipement_id] = String(r.temperature);
    }
    if (silencieux) {
      // Garde les champs que l'employé a déjà modifiés.
      setDrafts((prev) => {
        const next = { ...seed };
        for (const k of Object.keys(prev)) {
          const vieux = relevesRef.current.find((r) => r.equipement_id === k && r.periode === data.creneauActuel?.periode);
          if (prev[k] !== (vieux ? String(vieux.temperature) : "")) next[k] = prev[k];
        }
        return next;
      });
    } else {
      setDrafts(seed);
    }
    relevesRef.current = data.relevesDuJour || [];
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
      setMsg({ type: "err", text: t("temperature.erreurSauvegarde") });
      charger();
      return;
    }

    setMsg({ type: "ok", text: t("temperature.succesSauvegarde") });
    setTimeout(() => setMsg(null), 3000);
    charger();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>{t("nav.chargement")}</p>;
  }

  if (equipements.length === 0) {
    return (
      <div>
        <h2>{t("temperature.titre")}</h2>
        <p className="chat-empty">{t("temperature.aucun")}</p>
      </div>
    );
  }

  const periodeLabel = creneau?.periode === "am" ? t("temperature.matin") : creneau?.periode === "pm" ? t("temperature.soir") : "";
  const grille = { display: "grid", gridTemplateColumns: "1fr 104px 104px", gap: "8px", alignItems: "center", padding: "10px 14px" };

  // Une case AM ou PM : champ de saisie seulement pour le créneau actuel,
  // sinon la valeur déjà relevée en lecture seule (ou un tiret).
  function renderCase(eq, periode) {
    if (periode === creneau?.periode) {
      return (
        <TemperatureInput
          placeholder={`°${eq.unite === "F" ? "F" : "C"}`}
          value={drafts[eq.id] ?? ""}
          onChange={(v) => setDrafts((prev) => ({ ...prev, [eq.id]: v }))}
        />
      );
    }
    const r = releveExistant(eq.id, periode);
    return (
      <div style={{ textAlign: "center", fontSize: "13px", color: r ? "var(--text)" : "var(--text-dim)" }}>
        {r ? `${r.conforme ? "✓" : "⚠️"} ${r.temperature}°${eq.unite === "F" ? "F" : "C"}` : "—"}
      </div>
    );
  }

  return (
    <div>
      <h2>{t("temperature.titre")}</h2>
      <p className="panel-hint">{t("temperature.creneauActuel", { periode: periodeLabel })}</p>

      <div className="planning-day" style={{ marginBottom: "14px" }}>
        <div style={{ ...grille, paddingBottom: "6px", fontSize: "12px", fontWeight: 700, color: "var(--text-dim)" }}>
          <div>{t("temperature.equipement")}</div>
          {["am", "pm"].map((p) => (
            <div key={p} style={{ textAlign: "center", color: p === creneau?.periode ? "var(--text)" : undefined }}>
              {p.toUpperCase()}
              {p === creneau?.periode ? " ●" : ""}
            </div>
          ))}
        </div>
        {equipements.map((eq) => {
          const actuel = releveExistant(eq.id, creneau?.periode);
          return (
            <div key={eq.id} style={grille}>
              <div style={{ fontSize: "13.5px", fontWeight: 600, minWidth: 0 }}>
                {eq.nom}
                {actuel && (
                  <div style={{ fontSize: "11px", fontWeight: 400, color: "var(--text-dim)" }}>
                    {t("temperature.par")} {actuel.releve_par}
                  </div>
                )}
              </div>
              {renderCase(eq, "am")}
              {renderCase(eq, "pm")}
            </div>
          );
        })}
      </div>

      <div className="submit-wrap" style={{ marginTop: "16px", position: "static" }}>
        <button type="button" className="submit-btn" onClick={handleSave} disabled={saving || !estModifie()}>
          {saving ? t("temperature.enregistrement") : t("temperature.enregistrer")}
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
