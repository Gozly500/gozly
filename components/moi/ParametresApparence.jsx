"use client";

import { useEffect, useState } from "react";
import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY_MOI, isValidTheme, couleursDuTheme } from "@/lib/themes";
import TransitionTheme from "@/components/moi/TransitionTheme";
import MoiRetour from "@/components/moi/MoiRetour";

export default function ParametresApparence() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [transition, setTransition] = useState(null); // { id, couleurs } pendant l'animation

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(THEME_STORAGE_KEY_MOI);
      if (isValidTheme(cached)) setTheme(cached);
    } catch {}
  }, []);

  function appliquer(id) {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY_MOI, id);
    } catch {}
  }

  // Le thème ne change qu'au milieu de l'animation, quand le cercle couvre
  // tout l'écran (voir TransitionTheme.jsx).
  function handleSelect(id) {
    if (id === theme || transition) return;
    setTransition({ id, couleurs: couleursDuTheme(id) });
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

      {transition && (
        <TransitionTheme
          couleurs={transition.couleurs}
          onMilieu={() => appliquer(transition.id)}
          onFin={() => setTransition(null)}
        />
      )}
    </div>
  );
}
