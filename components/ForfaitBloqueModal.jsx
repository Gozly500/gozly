"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { MODULES, LABELS_FORFAIT } from "@/lib/modules";

// Bloque tout le tableau de bord (rendu par DashSidebar, donc présent sur
// chaque page /dashboard/*) quand l'entreprise a plus de modules actifs que
// son forfait ne le permet - ex: après une régression de forfait via
// Stripe, qui met à jour `entreprises.forfait` sans jamais désactiver les
// modules en trop. Pas de bouton "Fermer" : on sort d'ici seulement en
// désactivant des modules jusqu'à revenir dans la limite, ou en changeant
// de forfait.
export default function ForfaitBloqueModal({ entrepriseId, actifs, forfait, limite, onChange }) {
  const [busyId, setBusyId] = useState(null);

  const modulesActifs = MODULES.filter((m) => actifs.includes(m.id));
  const enTrop = actifs.length - limite;
  const forfaitLabel = forfait ? LABELS_FORFAIT[forfait] || forfait : "aucun forfait actif";

  async function desactiver(moduleId) {
    setBusyId(moduleId);
    await supabase.from("modules_actifs").delete().eq("entreprise_id", entrepriseId).eq("module", moduleId);
    setBusyId(null);
    onChange?.();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Trop de modules actifs</h3>
        </div>

        <p className="panel-hint">
          Ton forfait actuel ({forfaitLabel}) permet{" "}
          {Number.isFinite(limite) ? `${limite} module${limite > 1 ? "s" : ""}` : "un nombre illimité de modules"}, mais{" "}
          {actifs.length} sont actifs. Désactive-en {enTrop} pour continuer, ou choisis un forfait qui les couvre tous.
        </p>

        <div className="admin-list" style={{ marginBottom: "18px" }}>
          {modulesActifs.map((mod) => (
            <div className="admin-row" key={mod.id}>
              <div className="admin-row-main">
                <div className="admin-row-title">
                  {mod.icon} {mod.nom}
                </div>
              </div>
              <div className="admin-row-controls">
                <button
                  type="button"
                  className="admin-icon-btn danger"
                  onClick={() => desactiver(mod.id)}
                  disabled={busyId === mod.id}
                >
                  {busyId === mod.id ? "..." : "Désactiver"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <Link href="/parametres?tab=abonnement" className="submit-btn" style={{ width: "100%", textAlign: "center", textDecoration: "none", display: "block" }}>
          Choisir un nouveau forfait →
        </Link>
      </div>
    </div>
  );
}
