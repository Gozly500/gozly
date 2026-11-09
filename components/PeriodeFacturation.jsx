"use client";

import { useT } from "@/components/LangProvider";

// Choix de facturation : Mensuel ou Annuel (deux boutons côte à côte).
export default function PeriodeFacturation({ value, onChange, disabled }) {
  const { t } = useT();
  return (
    <div className="periode-toggle" role="radiogroup" aria-label={t("Facturation")}>
      {[
        { id: "mensuel", label: "Mensuel" },
        { id: "annuel", label: "Annuel" },
      ].map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={value === p.id}
          disabled={disabled}
          className={`periode-option${value === p.id ? " actif" : ""}`}
          onClick={() => onChange(p.id)}
        >
          {t(p.label)}
        </button>
      ))}
    </div>
  );
}
