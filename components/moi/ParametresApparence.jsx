"use client";

import { useEffect, useState } from "react";
import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY_MOI, isValidTheme } from "@/lib/themes";
import MoiRetour from "@/components/moi/MoiRetour";

export default function ParametresApparence() {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(THEME_STORAGE_KEY_MOI);
      if (isValidTheme(cached)) setTheme(cached);
    } catch {}
  }, []);

  function handleSelect(id) {
    if (id === theme) return;
    setTheme(id);
    document.documentElement.dataset.theme = id;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY_MOI, id);
    } catch {}
  }

  return (
    <div>
      <MoiRetour />
      <h2>Apparence</h2>
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
    </div>
  );
}
