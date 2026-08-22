"use client";

import Link from "next/link";
import { MODULES } from "@/lib/modules";

// Pur raccourci d'affichage - l'activation/désactivation des modules se
// fait uniquement via "Gérer les modules" dans la barre latérale
// (DashSidebar.jsx), jamais depuis ce widget.
export default function RaccourcisWidget({ actifs }) {
  const modulesActifs = MODULES.filter((m) => actifs.includes(m.id));

  if (modulesActifs.length === 0) {
    return <p className="widget-card-empty">Aucun module actif. Utilise "Gérer les modules" dans le menu pour en activer.</p>;
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
    </div>
  );
}
