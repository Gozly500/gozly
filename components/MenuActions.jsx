"use client";

import { useRef, useState } from "react";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";
import { IconFlecheBas } from "@/components/icons/Pictogrammes";

// Un bouton (ex : « Wix ») qui ouvre un petit menu d'actions. Sert à regrouper les actions d'une connexion (synchroniser,
// détacher, retirer les produits...) derrière un seul bouton, pour pouvoir en ajouter d'autres (Shopify...) sans encombrer la page.
// actions : [{ id, libelle, detail?, danger?, desactive?, onClick }] ; { separateur: true } pour un trait de séparation.
// Jamais de <select> natif : menu maison, comme le reste du dashboard.
export default function MenuActions({ libelle, icone, actions, className = "admin-icon-btn", alignement = "droite", disabled = false }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);
  useFermerAuClicExterieur(ref, ouvert, () => setOuvert(false));

  return (
    <div className="menu-actions" ref={ref}>
      <button type="button" className={className} aria-haspopup="menu" aria-expanded={ouvert} disabled={disabled} onClick={() => setOuvert((v) => !v)}>
        {icone}
        {icone ? " " : ""}
        {libelle}
        <span className="menu-actions-fleche">
          <IconFlecheBas className="gozly-icon-inline" />
        </span>
      </button>
      {ouvert && (
        <div className={`menu-actions-liste ${alignement}`} role="menu">
          {actions.map((a, i) =>
            a.separateur ? (
              <div key={`sep-${i}`} className="menu-actions-sep" />
            ) : (
              <button
                key={a.id}
                type="button"
                role="menuitem"
                disabled={a.desactive}
                className={`menu-actions-item${a.danger ? " danger" : ""}`}
                onClick={() => {
                  setOuvert(false);
                  a.onClick();
                }}
              >
                <span className="menu-actions-libelle">{a.libelle}</span>
                {a.detail && <span className="menu-actions-detail">{a.detail}</span>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
