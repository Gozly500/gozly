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
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    employeFetch("/api/employe-app/notifications/preferences").then(async (res) => {
      if (res.ok) setPrefs((await res.json()).preferences);
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
    </div>
  );
}
