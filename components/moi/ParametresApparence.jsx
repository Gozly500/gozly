"use client";

import { useEffect, useState } from "react";
import ThemeGrids from "@/components/ThemeGrids";
import {
  THEME_SOBRE,
  DEFAULT_THEME,
  THEME_STORAGE_KEY_MOI,
  THEME_COULEUR_STORAGE_KEY_MOI,
  isValidTheme,
  couleursDuTheme,
  estSobre,
} from "@/lib/themes";
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
      if (!estSobre(id)) window.localStorage.setItem(THEME_COULEUR_STORAGE_KEY_MOI, id);
    } catch {}
  }

  // Le thème ne change qu'au milieu de l'animation, quand le cercle couvre
  // tout l'écran (voir TransitionTheme.jsx).
  function handleSelect(id) {
    if (id === theme || transition) return;
    setTransition({ id, couleurs: couleursDuTheme(id) });
  }

  const sobre = estSobre(theme);

  // Case "Couleur" : décochée = mode sobre ; recochée = dernier thème coloré.
  function handleToggleCouleur(couleur) {
    if (couleur) {
      let dernier = null;
      try {
        dernier = window.localStorage.getItem(THEME_COULEUR_STORAGE_KEY_MOI);
      } catch {}
      handleSelect(isValidTheme(dernier) && !estSobre(dernier) ? dernier : DEFAULT_THEME);
    } else {
      handleSelect(THEME_SOBRE);
    }
  }

  return (
    <div>
      <MoiRetour />
      <h2>Apparence</h2>
      <p className="panel-hint">Choisis le thème visuel de l'application.</p>

      <div className="switch-row" style={{ marginBottom: "18px" }}>
        <div className="switch-row-text">
          <h4>Couleur</h4>
          <p>Décoche pour un affichage sobre, sans couleur de fond : Sombre ou Clair.</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={!sobre} disabled={!!transition} onChange={(e) => handleToggleCouleur(e.target.checked)} />
          <span className="switch-track"></span>
          <span className="switch-thumb"></span>
        </label>
      </div>

      <ThemeGrids theme={theme} onSelect={handleSelect} disabled={!!transition} />

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
