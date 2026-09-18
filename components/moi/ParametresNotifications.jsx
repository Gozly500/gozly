"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import NotificationsPush from "@/components/moi/NotificationsPush";
import MoiRetour from "@/components/moi/MoiRetour";

const TYPES_NOTIF = [
  { id: "notif_messages", titre: "Nouveaux messages", description: "Quand quelqu'un t'écrit dans Discussion." },
  { id: "notif_conge_traite", titre: "Réponse à une demande de congé", description: "Approuvée ou refusée." },
  { id: "notif_echange_recu", titre: "Échange de quart reçu", description: "Un collègue te propose son quart." },
  {
    id: "notif_echange_traite",
    titre: "Réponse à un échange de quart",
    description: "Ton collègue ou le proprio a répondu.",
  },
  { id: "notif_semaine_publiee", titre: "Nouvel horaire publié", description: "Ton horaire de la semaine est prêt." },
];

export default function ParametresNotifications() {
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
      <h2>Notifications</h2>
      <p className="panel-hint">Choisis ce qui déclenche une notification sur ton téléphone.</p>

      <NotificationsPush />

      {prefs && (
        <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {TYPES_NOTIF.map((t) => (
            <div className="switch-row" key={t.id}>
              <div className="switch-row-text">
                <h4>{t.titre}</h4>
                <p>{t.description}</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={prefs[t.id] !== false}
                  onChange={() => handleToggleNotif(t.id)}
                  disabled={saving === t.id}
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
