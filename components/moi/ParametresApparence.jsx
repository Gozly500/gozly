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
  DEFAULT_ACCENT,
  THEME_ACCENT_STORAGE_KEY_MOI,
  isValidAccent,
  appliquerAccent,
} from "@/lib/themes";
import TransitionTheme from "@/components/moi/TransitionTheme";
import MoiRetour from "@/components/moi/MoiRetour";
import { useLangue } from "@/components/moi/LangueContext";

export default function ParametresApparence() {
  const { t } = useLangue();
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [transition, setTransition] = useState(null); // { id, couleurs } pendant l'animation

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(THEME_STORAGE_KEY_MOI);
      if (isValidTheme(cached)) setTheme(cached);
      const accentCache = window.localStorage.getItem(THEME_ACCENT_STORAGE_KEY_MOI);
      if (isValidAccent(accentCache)) setAccent(accentCache);
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

  // L'accent est mémorisé sur l'appareil (comme le thème) et appliqué tout de suite.
  function handleSelectAccent(id) {
    setAccent(id);
    appliquerAccent(id);
    try {
      window.localStorage.setItem(THEME_ACCENT_STORAGE_KEY_MOI, id);
    } catch {}
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
      <h2>{t("apparence.titre")}</h2>
      <p className="panel-hint">{t("apparence.hint")}</p>

      <div className="switch-row" style={{ marginBottom: "18px" }}>
        <div className="switch-row-text">
          <h4>{t("apparence.couleurTitre")}</h4>
          <p>{t("apparence.couleurDesc")}</p>
        </div>
        <label className="switch">
          <input type="checkbox" checked={!sobre} disabled={!!transition} onChange={(e) => handleToggleCouleur(e.target.checked)} />
          <span className="switch-track"></span>
          <span className="switch-thumb"></span>
        </label>
      </div>

      <ThemeGrids theme={theme} onSelect={handleSelect} disabled={!!transition} accent={accent} onSelectAccent={handleSelectAccent} />

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
