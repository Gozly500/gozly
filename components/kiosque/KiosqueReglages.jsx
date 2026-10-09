"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeGrids from "@/components/ThemeGrids";
import {
  THEME_SOBRE,
  DEFAULT_THEME,
  THEME_STORAGE_KEY_KIOSQUE,
  THEME_COULEUR_STORAGE_KEY_KIOSQUE,
  isValidTheme,
  couleursDuTheme,
  estSobre,
  DEFAULT_ACCENT,
  THEME_ACCENT_STORAGE_KEY_KIOSQUE,
  isValidAccent,
  appliquerAccent,
} from "@/lib/themes";
import TransitionTheme from "@/components/moi/TransitionTheme";
import { useLangue } from "@/components/moi/LangueContext";
import { LANGUES } from "@/lib/i18n/moi";
import { IconFlecheGauche } from "@/components/icons/Pictogrammes";

// Réglages de la tablette : thème (+ accent) et langue, mémorisés sur la tablette seulement.
export default function KiosqueReglages() {
  const { t, langue, setLangue } = useLangue();
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [transition, setTransition] = useState(null); // { id, couleurs } pendant l'animation

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(THEME_STORAGE_KEY_KIOSQUE);
      if (isValidTheme(cached)) setTheme(cached);
      const accentCache = window.localStorage.getItem(THEME_ACCENT_STORAGE_KEY_KIOSQUE);
      if (isValidAccent(accentCache)) setAccent(accentCache);
    } catch {}
  }, []);

  function appliquer(id) {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY_KIOSQUE, id);
      if (!estSobre(id)) window.localStorage.setItem(THEME_COULEUR_STORAGE_KEY_KIOSQUE, id);
    } catch {}
  }

  // Le thème ne change qu'au milieu de l'animation, quand le cercle couvre tout l'écran.
  function handleSelect(id) {
    if (id === theme || transition) return;
    setTransition({ id, couleurs: couleursDuTheme(id) });
  }

  function handleSelectAccent(id) {
    setAccent(id);
    appliquerAccent(id);
    try {
      window.localStorage.setItem(THEME_ACCENT_STORAGE_KEY_KIOSQUE, id);
    } catch {}
  }

  const sobre = estSobre(theme);

  // Case "Couleur" : décochée = mode sobre ; recochée = dernier thème coloré.
  function handleToggleCouleur(couleur) {
    if (couleur) {
      let dernier = null;
      try {
        dernier = window.localStorage.getItem(THEME_COULEUR_STORAGE_KEY_KIOSQUE);
      } catch {}
      handleSelect(isValidTheme(dernier) && !estSobre(dernier) ? dernier : DEFAULT_THEME);
    } else {
      handleSelect(THEME_SOBRE);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: "720px", padding: "28px 16px 60px" }}>
      <Link href="/kiosque" className="admin-icon-btn" style={{ display: "inline-flex", gap: "6px", textDecoration: "none", marginBottom: "14px" }}>
        <IconFlecheGauche className="gozly-icon" /> {t("retour")}
      </Link>
      <h2>{t("kq.reglages.titre")}</h2>
      <p className="panel-hint">{t("kq.reglages.hint")}</p>

      <div className="switch-row" style={{ marginBottom: "22px" }}>
        <div className="switch-row-text">
          <h4>{t("kq.langue.titre")}</h4>
          <p>{t("kq.langue.desc")}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {LANGUES.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`admin-icon-btn${langue === l.id ? " active" : ""}`}
              style={langue === l.id ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
              onClick={() => setLangue(l.id)}
              aria-pressed={langue === l.id}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <h3 style={{ marginBottom: "4px" }}>{t("apparence.titre")}</h3>
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
        <TransitionTheme couleurs={transition.couleurs} onMilieu={() => appliquer(transition.id)} onFin={() => setTransition(null)} />
      )}
    </div>
  );
}
