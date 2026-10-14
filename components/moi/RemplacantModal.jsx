"use client";

import { useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { useLangue } from "@/components/moi/LangueContext";
import { localeDate } from "@/lib/i18n/moi";
import { dansLeQuart, erreurPlage } from "@/lib/echangeQuart";

// Lancer un appel de remplaçant pour un de mes quarts (en entier ou en partie) : les collègues disponibles reçoivent une
// notification, et le premier qui touche « Je prends » obtient le quart (voir supabase/appels_remplacant.sql).
export default function RemplacantModal({ quart, onClose }) {
  const { t, langue } = useLangue();
  const [debut, setDebut] = useState(quart.heure_debut.slice(0, 5));
  const [fin, setFin] = useState(quart.heure_fin.slice(0, 5));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function envoyer(e) {
    e.preventDefault();
    if (busy) return;
    const entier = debut === quart.heure_debut.slice(0, 5) && fin === quart.heure_fin.slice(0, 5);
    const erreur = entier ? null : erreurPlage(debut, fin, quart);
    if (erreur) {
      setMsg({ type: "err", text: erreur });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await employeFetch("/api/employe-app/remplacements", {
        method: "POST",
        body: JSON.stringify({ quartId: quart.id, heureDebut: debut, heureFin: fin, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ type: "err", text: data.error || t("rem.erreur") });
      else setMsg({ type: "ok", text: t("rem.envoye") });
    } catch {
      setMsg({ type: "err", text: t("rem.erreur") });
    }
    setBusy(false);
  }

  const envoye = msg?.type === "ok";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("rem.titre")}</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            {t("nav.fermer")}
          </button>
        </div>

        <p className="panel-hint">
          {new Date(quart.date).toLocaleDateString(localeDate(langue), { weekday: "long", day: "numeric", month: "long" })} · {quart.heure_debut.slice(0, 5)}–{quart.heure_fin.slice(0, 5)}
        </p>
        <p className="panel-hint">{t("rem.hint")}</p>

        {!envoye && (
          <form onSubmit={envoyer}>
            <div className="field">
              <label>{t("rem.heures")}</label>
              <div className="field-row">
                <input
                  type="time"
                  value={debut}
                  min={quart.heure_debut.slice(0, 5)}
                  max={quart.heure_fin.slice(0, 5)}
                  onChange={(e) => setDebut(e.target.value)}
                  onBlur={() => setDebut((v) => dansLeQuart(v, quart))}
                />
                <input
                  type="time"
                  value={fin}
                  min={quart.heure_debut.slice(0, 5)}
                  max={quart.heure_fin.slice(0, 5)}
                  onChange={(e) => setFin(e.target.value)}
                  onBlur={() => setFin((v) => dansLeQuart(v, quart))}
                />
              </div>
            </div>
            <div className="field">
              <label>{t("rem.note")}</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t("rem.notePlaceholder")} />
            </div>
            {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
            <button type="submit" className="submit-btn" style={{ width: "100%" }} disabled={busy || !debut || !fin}>
              {t("rem.envoyer")}
            </button>
          </form>
        )}
        {envoye && <p className="settings-msg ok">{msg.text}</p>}
      </div>
    </div>
  );
}
