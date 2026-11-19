"use client";

import { useState } from "react";
import { IconFlecheDroite, IconFlecheGauche } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";

const deuxChiffres = (n) => String(n).padStart(2, "0");
const iso = (a, m, j) => `${a}-${deuxChiffres(m + 1)}-${deuxChiffres(j)}`;

// Petit calendrier mensuel pour choisir UNE journée (ex. la journée de ventes à importer).
// value / max : "AAAA-MM-JJ" ; marquees : dates déjà importées (petit point) ; les jours après `max` sont grisés.
export default function CalendrierJour({ value, onChange, max, marquees }) {
  const { t } = useT();
  const depart = value ? new Date(`${value}T00:00:00`) : new Date();
  const [vue, setVue] = useState({ a: depart.getFullYear(), m: depart.getMonth() });

  const premier = new Date(vue.a, vue.m, 1);
  const decalage = (premier.getDay() + 6) % 7; // semaine qui commence le lundi
  const nbJours = new Date(vue.a, vue.m + 1, 0).getDate();
  const cases = [...Array(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => i + 1)];

  function bouge(delta) {
    const d = new Date(vue.a, vue.m + delta, 1);
    setVue({ a: d.getFullYear(), m: d.getMonth() });
  }

  const nomsJours = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(loc(), { weekday: "narrow" })
  );

  return (
    <div className="cal-jour">
      <div className="cal-jour-tete">
        <button type="button" className="admin-icon-btn" onClick={() => bouge(-1)} aria-label={t("Mois précédent")}>
          <IconFlecheGauche className="gozly-icon" />
        </button>
        <strong>{premier.toLocaleDateString(loc(), { month: "long", year: "numeric" })}</strong>
        <button type="button" className="admin-icon-btn" onClick={() => bouge(1)} aria-label={t("Mois suivant")}>
          <IconFlecheDroite className="gozly-icon" />
        </button>
      </div>
      <div className="cal-jour-grille">
        {nomsJours.map((n, i) => (
          <span key={i} className="cal-jour-nom">
            {n}
          </span>
        ))}
        {cases.map((j, i) => {
          if (!j) return <span key={i} />;
          const d = iso(vue.a, vue.m, j);
          const interdit = max && d > max;
          return (
            <button
              key={i}
              type="button"
              disabled={interdit}
              className={`cal-jour-case${d === value ? " choisi" : ""}${marquees?.has(d) ? " marque" : ""}`}
              onClick={() => onChange(d)}
            >
              {j}
            </button>
          );
        })}
      </div>
    </div>
  );
}
