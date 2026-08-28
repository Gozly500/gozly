"use client";

import { useState } from "react";

// Menu déroulant "maison" générique ({id, label}[]) - un <select> natif ne
// peut pas être stylé proprement (le menu ouvert reste blanc). Mêmes
// classes que PersonnalisationSection/EmplacementSelect (.forfait-select-*).
export default function SimpleSelect({ options, value, onChange, placeholder = "Choisir..." }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);

  return (
    <div className="forfait-select-wrap">
      <div className={`forfait-select-trigger${open ? " open" : ""}`} onClick={() => setOpen((v) => !v)}>
        <div className="fs-label">{current ? current.label : placeholder}</div>
        <span className="fs-arrow">▾</span>
      </div>
      {open && (
        <div className="forfait-select-options open">
          {options.map((o) => (
            <div
              key={o.id}
              className="forfait-option"
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            >
              <div className="fo-label">{o.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
