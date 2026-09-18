"use client";

import { useEffect, useState } from "react";
import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY_MOI, isValidTheme } from "@/lib/themes";
import { employeFetch } from "@/lib/employeAuth";
import NotificationsPush from "@/components/moi/NotificationsPush";

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

export default function ParametresEmploye() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(THEME_STORAGE_KEY_MOI);
      if (isValidTheme(cached)) setTheme(cached);
    } catch {}

    employeFetch("/api/employe-app/notifications/preferences").then(async (res) => {
      if (res.ok) setPrefs((await res.json()).preferences);
    });
  }, []);

  function handleSelect(id) {
    if (id === theme) return;
    setTheme(id);
    document.documentElement.dataset.theme = id;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY_MOI, id);
    } catch {}
  }

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
      <h2>Paramètres</h2>
      <p className="panel-hint">Choisis le thème visuel de l'application.</p>

      <div className="theme-grid">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`theme-choice${theme === t.id ? " selected" : ""}`}
            onClick={() => handleSelect(t.id)}
          >
            <span className="theme-swatch" style={{ background: t.swatch }} />
            <span className="theme-choice-text">
              <strong>{t.label}</strong>
              <span>{t.description}</span>
            </span>
            {theme === t.id && <span className="theme-check">✓</span>}
          </button>
        ))}
      </div>

      <h2 style={{ marginTop: "32px" }}>Notifications</h2>
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
