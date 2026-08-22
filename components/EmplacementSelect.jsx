"use client";

import { useState } from "react";

// Menu déroulant "maison" pour choisir l'emplacement actif - un <select>
// natif ne peut pas être stylé proprement (le menu ouvert reste blanc,
// dessiné par le navigateur), donc on reconstruit l'UI nous-mêmes.
export default function EmplacementSelect({ emplacements, value, onChange, includeToutes }) {
  const [open, setOpen] = useState(false);

  if (emplacements.length <= 1) return null;

  const options = includeToutes ? [{ id: null, nom: "Toutes les succursales" }, ...emplacements] : emplacements;
  const current = options.find((o) => o.id === value) || options[0];

  return (
    <div className="emplacement-select-wrap">
      <div className={`emplacement-select-trigger${open ? " open" : ""}`} onClick={() => setOpen((v) => !v)}>
        <span>{current?.id ? `📍 ${current.nom}` : current?.nom}</span>
        <span className="fs-arrow">▾</span>
      </div>
      {open && (
        <div className="emplacement-select-options">
          {options.map((o) => (
            <div
              key={o.id ?? "toutes"}
              className={`emplacement-select-option${o.id === value ? " active" : ""}`}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            >
              {o.id ? `📍 ${o.nom}` : o.nom}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
