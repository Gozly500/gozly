"use client";

import { THEMES_COULEUR, THEMES_SOBRES, estSobre } from "@/lib/themes";

function Choix({ t, theme, onSelect, disabled }) {
  const inactif = disabled;
  return (
    <button
      type="button"
      className={`theme-choice${theme === t.id ? " selected" : ""}`}
      onClick={() => onSelect(t.id)}
      disabled={inactif}
    >
      <span className="theme-swatch" style={{ background: t.swatch }} />
      <span className="theme-choice-text">
        <strong>{t.label}</strong>
        <span>{t.description}</span>
      </span>
      {theme === t.id && <span className="theme-check">✓</span>}
    </button>
  );
}

// Grille des thèmes : colorés quand "Couleur" est cochée ; sinon Sombre/Clair
// actifs et les thèmes colorés grisés et inaccessibles.
export default function ThemeGrids({ theme, onSelect, disabled }) {
  const sobre = estSobre(theme);

  return (
    <>
      {sobre && (
        <div className="theme-grid" style={{ marginBottom: "22px" }}>
          {THEMES_SOBRES.map((t) => (
            <Choix key={t.id} t={t} theme={theme} onSelect={onSelect} disabled={disabled} />
          ))}
        </div>
      )}

      <div className={`theme-grid${sobre ? " theme-grid-inactif" : ""}`} aria-disabled={sobre || undefined}>
        {THEMES_COULEUR.map((t) => (
          <Choix key={t.id} t={t} theme={sobre ? null : theme} onSelect={onSelect} disabled={disabled || sobre} />
        ))}
      </div>
    </>
  );
}
