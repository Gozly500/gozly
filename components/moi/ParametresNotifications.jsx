"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import NotificationsPush from "@/components/moi/NotificationsPush";
import MoiRetour from "@/components/moi/MoiRetour";
import { useLangue } from "@/components/moi/LangueContext";

const TYPES_NOTIF = [
  { id: "notif_messages", titreCle: "notifications.messagesTitre", descCle: "notifications.messagesDesc" },
  { id: "notif_conge_traite", titreCle: "notifications.congeTraiteTitre", descCle: "notifications.congeTraiteDesc" },
  { id: "notif_echange_recu", titreCle: "notifications.echangeRecuTitre", descCle: "notifications.echangeRecuDesc" },
  { id: "notif_echange_traite", titreCle: "notifications.echangeTraiteTitre", descCle: "notifications.echangeTraiteDesc" },
  { id: "notif_semaine_publiee", titreCle: "notifications.semainePublieeTitre", descCle: "notifications.semainePublieeDesc" },
];

export default function ParametresNotifications() {
  const { t } = useLangue();
  const [prefs, setPrefs] = useState(null);
  const [calmes, setCalmes] = useState(null); // { actif, debut, fin } ; null tant que le SQL des heures calmes n'est pas exécuté
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    employeFetch("/api/employe-app/notifications/preferences").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setPrefs(data.preferences);
        setCalmes(data.heuresCalmes || null);
      }
    });
  }, []);

  async function handleToggleNotif(colonne) {
    const valeur = !prefs[colonne];
    setPrefs((cur) => ({ ...cur, [colonne]: valeur }));
    setSaving(colonne);
    await employeFetch("/api/employe-app/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify({ [colonne]: valeur }),
    });
    setSaving(null);
  }

  // Heures calmes : enregistrées tout de suite.
  async function changerCalmes(partie) {
    const suivant = { ...calmes, ...partie };
    setCalmes(suivant);
    await employeFetch("/api/employe-app/notifications/preferences", {
      method: "PATCH",
      body: JSON.stringify({ heures_calmes_actif: suivant.actif, heures_calmes_debut: suivant.debut, heures_calmes_fin: suivant.fin }),
    });
  }

  return (
    <div>
      <MoiRetour />
      <h2>{t("notifications.titre")}</h2>
      <p className="panel-hint">{t("notifications.hint")}</p>

      <NotificationsPush />

      {prefs && (
        <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {TYPES_NOTIF.map((tn) => (
            <div className="switch-row" key={tn.id}>
              <div className="switch-row-text">
                <h4>{t(tn.titreCle)}</h4>
                <p>{t(tn.descCle)}</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={prefs[tn.id] !== false}
                  onChange={() => handleToggleNotif(tn.id)}
                  disabled={saving === tn.id}
                />
                <span className="switch-track"></span>
                <span className="switch-thumb"></span>
              </label>
            </div>
          ))}
        </div>
      )}

      {calmes && (
        <div style={{ marginTop: "18px" }}>
          <div className="switch-row">
            <div className="switch-row-text">
              <h4>{t("notifications.calmesTitre")}</h4>
              <p>{t("notifications.calmesDesc")}</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={calmes.actif} onChange={(e) => changerCalmes({ actif: e.target.checked })} />
              <span className="switch-track"></span>
              <span className="switch-thumb"></span>
            </label>
          </div>
          {calmes.actif && (
            <div className="field-row" style={{ marginTop: "10px" }}>
              <div className="field">
                <label>{t("notifications.calmesDe")}</label>
                <input type="time" value={calmes.debut} onChange={(e) => e.target.value && changerCalmes({ debut: e.target.value })} />
              </div>
              <div className="field">
                <label>{t("notifications.calmesA")}</label>
                <input type="time" value={calmes.fin} onChange={(e) => e.target.value && changerCalmes({ fin: e.target.value })} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
