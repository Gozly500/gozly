"use client";

import Link from "next/link";
import { MODULES, limiteModules } from "@/lib/modules";

export default function RaccourcisWidget({ actifs, forfait, editMode, onOuvrirModules }) {
  const limite = limiteModules(forfait);
  const modulesActifs = MODULES.filter((m) => actifs.includes(m.id));
  const placeholders = editMode
    ? Math.max(0, Math.min(limite === Infinity ? 4 : limite, 4) - modulesActifs.length)
    : 0;

  if (modulesActifs.length === 0 && placeholders === 0) {
    return <p className="widget-card-empty">Aucun module actif. Passe en mode édition pour en activer.</p>;
  }

  return (
    <div className="dash-modules-grid">
      {modulesActifs.map((mod) => (
        <Link
          key={mod.id}
          href={mod.href}
          className={`dash-module-card active${mod.image ? "" : " fallback"}`}
          title={mod.nom}
        >
          {mod.image ? (
            <img src={mod.image} alt={mod.nom} className="dash-module-image" />
          ) : (
            <>
              <span className="dash-module-emoji">{mod.icon}</span>
              <span className="dash-module-name">{mod.nom}</span>
            </>
          )}
        </Link>
      ))}
      {Array.from({ length: placeholders }).map((_, i) => (
        <div key={i} className="dash-module-card" onClick={onOuvrirModules}>
          +
        </div>
      ))}
    </div>
  );
}
