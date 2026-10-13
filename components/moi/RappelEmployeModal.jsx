"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";
import { localeDate } from "@/lib/i18n/moi";
import { DUREES_RAPPEL_HEURES } from "@/lib/rappels";

// Créer un rappel depuis l'app employé : pour une personne précise (ouvert depuis le menu « + » d'une
// discussion : `fixes` = [son id]) ou pour tout le monde / des personnes au choix (menu « + Nouveau »).
// Le rappel s'affiche en évidence chez ses destinataires, en haut de l'app, jusqu'à son expiration (1 semaine max).
export default function RappelEmployeModal({ fixes, nomFixe, tous, onClose }) {
  const { t, langue } = useLangue();
  const [contenu, setContenu] = useState("");
  const [duree, setDuree] = useState("24");
  const [pourTous, setPourTous] = useState(true);
  const [ids, setIds] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [mes, setMes] = useState([]);

  useEffect(() => {
    chargerMes();
  }, []);

  async function chargerMes() {
    try {
      const res = await employeFetch("/api/employe-app/rappels");
      if (!res.ok) return;
      const data = await res.json();
      setMes(data.crees || []);
    } catch {}
  }

  async function creer(e) {
    e.preventDefault();
    if (!contenu.trim() || busy) return;
    if (!fixes && !pourTous && ids.size === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await employeFetch("/api/employe-app/rappels", {
        method: "POST",
        body: JSON.stringify({
          contenu: contenu.trim(),
          dureeHeures: Number(duree),
          pourTous: fixes ? false : pourTous,
          employeIds: fixes || [...ids],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || t("rap.erreur") });
      } else {
        setContenu("");
        setIds(new Set());
        setMsg({ type: "ok", text: t("rap.cree") });
        chargerMes();
      }
    } catch {
      setMsg({ type: "err", text: t("rap.erreur") });
    }
    setBusy(false);
  }

  async function retirer(id) {
    try {
      await employeFetch(`/api/employe-app/rappels?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {}
    chargerMes();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("rap.titreModal")}</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            {t("nav.fermer")}
          </button>
        </div>

        <form onSubmit={creer}>
          <div className="field">
            <textarea value={contenu} onChange={(e) => setContenu(e.target.value)} rows={3} maxLength={400} placeholder={t("rap.placeholder")} />
          </div>

          <div className="field">
            <label>{t("rap.duree")}</label>
            <select value={duree} onChange={(e) => setDuree(e.target.value)}>
              {DUREES_RAPPEL_HEURES.map((h) => (
                <option key={h} value={String(h)}>
                  {t(`rap.d.${h}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>{t("rap.pour")}</label>
            {fixes ? (
              <p className="panel-hint" style={{ margin: 0 }}>{t("rap.pourPersonne", { nom: nomFixe })}</p>
            ) : (
              <>
                <label className="moi-picker-row" style={{ cursor: "pointer" }}>
                  <span>{t("rap.tous")}</span>
                  <input type="checkbox" checked={pourTous} onChange={(e) => setPourTous(e.target.checked)} />
                </label>
                {!pourTous && (
                  <div className="moi-picker-list" style={{ marginTop: "6px" }}>
                    {tous.map((c) => (
                      <label className="moi-picker-row" key={c.id} style={{ cursor: "pointer" }}>
                        <span>{c.nom}</span>
                        <input
                          type="checkbox"
                          checked={ids.has(c.id)}
                          onChange={() =>
                            setIds((prev) => {
                              const suivant = new Set(prev);
                              if (suivant.has(c.id)) suivant.delete(c.id);
                              else suivant.add(c.id);
                              return suivant;
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
          <button type="submit" className="submit-btn" style={{ width: "100%" }} disabled={busy || !contenu.trim() || (!fixes && !pourTous && ids.size === 0)}>
            {t("rap.creerBouton")}
          </button>
        </form>

        {mes.length > 0 && (
          <div style={{ marginTop: "18px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: 600 }}>{t("rap.mes")}</h4>
            <div className="moi-picker-list">
              {mes.map((r) => (
                <div className="moi-picker-row" key={r.id} style={{ alignItems: "flex-start" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {r.contenu}
                    <br />
                    <small style={{ opacity: 0.7 }}>
                      {r.pourTous ? t("rap.pourTous") : t("rap.pourN", { n: r.nb })} · {t("annonce.jusqua", { date: new Date(r.fin).toLocaleDateString(localeDate(langue), { day: "numeric", month: "short" }) })}
                    </small>
                  </span>
                  <button type="button" className="admin-icon-btn" onClick={() => retirer(r.id)}>
                    {t("rap.retirer")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
