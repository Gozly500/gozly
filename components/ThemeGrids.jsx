"use client";

import { THEMES, THEMES_COULEUR, THEME_SOBRE } from "@/lib/themes";

// Choix "sobres" affichés quand la case "Couleur" est décochée. "clair" n'existe
// pas encore (pas dans THEMES, donc jamais applicable) : il est affiché
// désactivé, avec "Bientôt".
const CHOIX_SOBRES = [
  { id: THEME_SOBRE, label: "Sombre", description: "Fond noir uni.", swatch: "#0b0b0d" },
  { id: "clair", label: "Clair", description: "Fond blanc.", swatch: "#f4f4f5", bientot: true },
];

function Choix({ t, theme, onSelect, disabled }) {
  const inactif = disabled || t.bientot;
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
        <span>{t.bientot ? "Bientôt disponible" : t.description}</span>
      </span>
      {theme === t.id && <span className="theme-check">✓</span>}
    </button>
  );
}

// Grille des thèmes : colorés quand "Couleur" est cochée ; sinon Sombre/Clair
// actifs et les thèmes colorés grisés et inaccessibles.
export default function ThemeGrids({ theme, onSelect, disabled }) {
  const sobre = THEMES.find((t) => t.id === theme)?.sobre;

  return (
    <>
      {sobre && (
        <div className="theme-grid" style={{ marginBottom: "22px" }}>
          {CHOIX_SOBRES.map((t) => (
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
