"use client";

import { useRef, useState } from "react";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";
import { IconFlecheBas } from "@/components/icons/Pictogrammes";

// Menu déroulant "maison" du panneau admin (jamais de <select> natif : le menu ouvert resterait blanc).
// options : [{ id, nom, groupe? }] - un titre de groupe s'affiche quand "groupe" change.
export default function MenuAdmin({ options, value, onChange, placeholder = "Choisir..." }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useFermerAuClicExterieur(ref, open, () => setOpen(false));
  const courant = options.find((o) => o.id === value);

  let dernierGroupe = null;
  return (
    <div className="emplacement-select-wrap" ref={ref} style={{ minWidth: "260px" }}>
      <div className={`emplacement-select-trigger${open ? " open" : ""}`} onClick={() => setOpen((v) => !v)}>
        <span style={courant ? undefined : { color: "var(--text-dim)" }}>{courant ? courant.nom : placeholder}</span>
        <span className="fs-arrow">
          <IconFlecheBas className="gozly-icon-inline" />
        </span>
      </div>
      {open && (
        <div className="emplacement-select-options" style={{ maxHeight: "320px", overflowY: "auto" }}>
          {options.map((o) => {
            const titre = o.groupe && o.groupe !== dernierGroupe ? o.groupe : null;
            dernierGroupe = o.groupe ?? dernierGroupe;
            return (
              <div key={o.id}>
                {titre && <div className="menu-admin-groupe">{titre}</div>}
                <div
                  className={`emplacement-select-option${o.id === value ? " active" : ""}`}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  {o.nom}
                </div>
              </div>
            );
          })}
          {options.length === 0 && <div className="emplacement-select-option">Aucun choix</div>}
        </div>
      )}
    </div>
  );
}
