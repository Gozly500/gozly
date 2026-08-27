"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/themes";

export default function AppearanceSection({ profil, setProfil }) {
  const [theme, setThemeState] = useState(profil?.theme || DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleSelect(id) {
    if (id === theme || !profil || saving) return;

    const previous = theme;
    setThemeState(id);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("profils").update({ theme: id }).eq("id", profil.id);

    setSaving(false);

    if (error) {
      setThemeState(previous);
      setMsg({ type: "err", text: "Le changement de thème a échoué. Réessaie dans un instant." });
      return;
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {}

    setProfil({ ...profil, theme: id });
    setMsg({ type: "ok", text: "Thème appliqué au tableau de bord !" });
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div>
      <h2>Apparence</h2>
      <p className="panel-hint">Choisis le thème visuel de ton tableau de bord.</p>

      <div className="theme-grid">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`theme-choice${theme === t.id ? " selected" : ""}`}
            onClick={() => handleSelect(t.id)}
            disabled={saving}
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

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
    </div>
  );
}
