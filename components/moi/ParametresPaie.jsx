"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import MoiRetour from "@/components/moi/MoiRetour";
import { useLangue } from "@/components/moi/LangueContext";

// Paramètres > Paie : active le calculateur de paie (désactivé par défaut) et enregistre le taux horaire.
// Activer crée une ligne privée (supabase/employe_paie.sql) ; désactiver la supprime, donc le taux est effacé.
export default function ParametresPaie() {
  const { t } = useLangue();
  const [etat, setEtat] = useState(null); // null = chargement ; { actif, taux } ; { indisponible: true }
  const [taux, setTaux] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [confirmerOff, setConfirmerOff] = useState(false);
  const [message, setMessage] = useState(null); // { type: "ok" | "err", text }

  useEffect(() => {
    employeFetch("/api/employe-app/paie")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return setEtat({ indisponible: true });
        setEtat({ actif: !!data.actif, taux: data.taux ?? null });
        if (data.taux != null) setTaux(String(data.taux).replace(".", ","));
      })
      .catch(() => setEtat({ indisponible: true }));
  }, []);

  async function changerActif(actif) {
    setOccupe(true);
    setMessage(null);
    const res = await employeFetch("/api/employe-app/paie", { method: "PATCH", body: JSON.stringify({ actif }) });
    setOccupe(false);
    if (!res.ok) return setMessage({ type: "err", text: t("paie.erreur") });
    setConfirmerOff(false);
    if (!actif) setTaux("");
    setEtat({ actif, taux: null });
  }

  async function enregistrerTaux() {
    setOccupe(true);
    setMessage(null);
    const res = await employeFetch("/api/employe-app/paie", { method: "PATCH", body: JSON.stringify({ taux }) });
    const data = await res.json().catch(() => ({}));
    setOccupe(false);
    if (!res.ok) return setMessage({ type: "err", text: data.error || t("paie.erreur") });
    setEtat({ actif: true, taux: data.taux });
    setTaux(String(data.taux).replace(".", ","));
    setMessage({ type: "ok", text: t("paie.enregistre") });
  }

  return (
    <div>
      <MoiRetour />
      <h2>{t("paie.titre")}</h2>
      <p className="panel-hint">{t("paie.hint")}</p>

      {!etat ? (
        <p style={{ color: "var(--text-dim)" }}>{t("paie.chargement")}</p>
      ) : etat.indisponible ? (
        <p className="settings-msg err">{t("paie.indisponible")}</p>
      ) : (
        <>
          <div className="switch-row">
            <div className="switch-row-text">
              <h4>{t("paie.activer")}</h4>
              <p>{t("paie.activerDesc")}</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={etat.actif}
                disabled={occupe}
                onChange={(e) => (e.target.checked ? changerActif(true) : setConfirmerOff(true))}
              />
              <span className="switch-track"></span>
              <span className="switch-thumb"></span>
            </label>
          </div>

          {confirmerOff && (
            <div className="settings-section" style={{ marginTop: "12px" }}>
              <h4 style={{ margin: "0 0 6px" }}>{t("paie.desactiverTitre")}</h4>
              <p className="section-hint" style={{ margin: "0 0 12px" }}>{t("paie.desactiverTexte")}</p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="btn-danger" disabled={occupe} onClick={() => changerActif(false)}>
                  {t("paie.desactiverOui")}
                </button>
                <button type="button" className="admin-icon-btn" onClick={() => setConfirmerOff(false)}>
                  {t("paie.annuler")}
                </button>
              </div>
            </div>
          )}

          {etat.actif && (
            <div style={{ marginTop: "18px" }}>
              <div className="field">
                <label>{t("paie.taux")}</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={taux}
                    onChange={(e) => setTaux(e.target.value)}
                    placeholder={t("paie.tauxPh")}
                    maxLength={8}
                    style={{ flex: 1, margin: 0 }}
                  />
                  <span style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>{t("paie.parHeure")}</span>
                </div>
              </div>
              <button type="button" className="submit-btn" style={{ width: "100%" }} disabled={occupe || !taux.trim()} onClick={enregistrerTaux}>
                {t("paie.enregistrer")}
              </button>
              <p className="section-hint" style={{ marginTop: "12px" }}>{t("paie.confidentiel")}</p>
            </div>
          )}

          {message && <p className={`settings-msg ${message.type}`} style={{ marginTop: "12px" }}>{message.text}</p>}
        </>
      )}
    </div>
  );
}
