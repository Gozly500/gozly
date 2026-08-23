"use client";

import Link from "next/link";
import { MODULES } from "@/lib/modules";

// L'activation/désactivation des modules eux-mêmes se fait uniquement
// via "Gérer les modules" dans la barre latérale (DashSidebar.jsx) -
// ce widget permet seulement de choisir, en mode édition, lesquels des
// modules déjà actifs apparaissent comme raccourci ici.
export default function RaccourcisWidget({ actifs, editMode, modulesCaches, onToggleModule }) {
  const modulesActifs = MODULES.filter((m) => actifs.includes(m.id));
  const modulesAffiches = editMode ? modulesActifs : modulesActifs.filter((m) => !modulesCaches.includes(m.id));

  if (modulesAffiches.length === 0) {
    return (
      <p className="widget-card-empty">
        {modulesActifs.length === 0
          ? 'Aucun module actif. Utilise "Gérer les modules" dans le menu pour en activer.'
          : "Tous tes raccourcis sont masqués. Passe en mode édition pour en réafficher."}
      </p>
    );
  }

  return (
    <div className="dash-modules-grid">
      {modulesAffiches.map((mod) => {
        const cache = modulesCaches.includes(mod.id);
        return (
          <div key={mod.id} className={`dash-module-tile${editMode && cache ? " edit-hidden" : ""}`}>
            <Link href={mod.href} className={`dash-module-card active${mod.image ? "" : " fallback"}`} title={mod.nom}>
              {mod.image ? (
                <img src={mod.image} alt={mod.nom} className="dash-module-image" />
              ) : (
                <>
                  <span className="dash-module-emoji">{mod.icon}</span>
                  <span className="dash-module-name">{mod.nom}</span>
                </>
              )}
            </Link>
            {editMode && (
              <button
                type="button"
                className={`dash-module-toggle${cache ? "" : " on"}`}
                onClick={() => onToggleModule(mod.id)}
              >
                {cache ? "Afficher" : "Masquer"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
