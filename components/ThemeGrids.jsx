"use client";

import { THEMES_COULEUR, THEMES_SOBRES, ACCENTS, estSobre } from "@/lib/themes";

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

// Thèmes colorés (interrupteur "Couleur" allumé) ; sinon Sombre/Clair + la couleur
// d'accent (bouton principal et barre latérale).
export default function ThemeGrids({ theme, onSelect, disabled, accent, onSelectAccent }) {
  const sobre = estSobre(theme);

  if (!sobre) {
    return (
      <div className="theme-grid">
        {THEMES_COULEUR.map((t) => (
          <Choix key={t.id} t={t} theme={theme} onSelect={onSelect} disabled={disabled} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="theme-grid" style={{ marginBottom: "26px" }}>
        {THEMES_SOBRES.map((t) => (
          <Choix key={t.id} t={t} theme={theme} onSelect={onSelect} disabled={disabled} />
        ))}
      </div>

      <h4 style={{ fontSize: "14.5px", fontWeight: 600 }}>Couleur d'accent</h4>
      <p className="panel-hint" style={{ margin: "2px 0 0" }}>
        Colore le bouton principal et la barre latérale. Le reste garde un fond neutre.
      </p>
      <div className="accent-row">
        {ACCENTS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`accent-choice${accent === a.id ? " selected" : ""}`}
            onClick={() => onSelectAccent(a.id)}
            disabled={disabled}
            aria-pressed={accent === a.id}
          >
            <span className="accent-dot" style={{ background: a.couleur }} />
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}
