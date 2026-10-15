"use client";

import { THEMES_COULEUR, THEMES_SOBRES, ACCENTS, estSobre } from "@/lib/themes";
import { IconCrochet } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";

function Choix({ th, theme, onSelect, disabled }) {
  const { t } = useT();
  const inactif = disabled;
  return (
    <button
      type="button"
      className={`theme-choice${theme === th.id ? " selected" : ""}`}
      onClick={() => onSelect(th.id)}
      disabled={inactif}
    >
      <span className="theme-swatch" style={{ background: th.swatch }} />
      <span className="theme-choice-text">
        <strong>{t(th.label)}</strong>
        <span>{t(th.description)}</span>
      </span>
      {theme === th.id && <span className="theme-check"><IconCrochet className="gozly-icon" /></span>}
    </button>
  );
}

// Thèmes colorés (interrupteur "Couleur" allumé) ; sinon Sombre/Clair + la couleur
// d'accent (bouton principal et barre latérale).
export default function ThemeGrids({ theme, onSelect, disabled, accent, onSelectAccent }) {
  const { t } = useT();
  const sobre = estSobre(theme);

  if (!sobre) {
    return (
      <div className="theme-grid">
        {THEMES_COULEUR.map((th) => (
          <Choix key={th.id} th={th} theme={theme} onSelect={onSelect} disabled={disabled} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="theme-grid" style={{ marginBottom: "26px" }}>
        {THEMES_SOBRES.map((th) => (
          <Choix key={th.id} th={th} theme={theme} onSelect={onSelect} disabled={disabled} />
        ))}
      </div>

      <h4 style={{ fontSize: "14.5px", fontWeight: 600 }}>{t("Couleur d'accent")}</h4>
      <p className="panel-hint" style={{ margin: "2px 0 0" }}>
        {t("Colore le bouton principal et la barre latérale. Le reste garde un fond neutre.")}
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
            {t(a.label)}
          </button>
        ))}
      </div>
    </>
  );
}
