"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { MODULES, limiteModules } from "@/lib/modules";

export default function ModulesModal({ entrepriseId, onClose, onChange }) {
  const [loading, setLoading] = useState(true);
  const [forfait, setForfait] = useState(null);
  const [actifs, setActifs] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);

    const { data: entreprise } = await supabase
      .from("entreprises")
      .select("forfait")
      .eq("id", entrepriseId)
      .maybeSingle();

    const { data: modules } = await supabase
      .from("modules_actifs")
      .select("module")
      .eq("entreprise_id", entrepriseId);

    setForfait(entreprise?.forfait || null);
    setActifs((modules || []).map((m) => m.module));
    setLoading(false);
  }

  const limite = limiteModules(forfait);
  const compte = actifs.length;

  async function handleToggle(moduleId) {
    setBusyId(moduleId);
    const estActif = actifs.includes(moduleId);

    if (estActif) {
      await supabase.from("modules_actifs").delete().eq("entreprise_id", entrepriseId).eq("module", moduleId);
      setActifs((prev) => prev.filter((m) => m !== moduleId));
    } else if (compte < limite) {
      await supabase.from("modules_actifs").insert({ entreprise_id: entrepriseId, module: moduleId });
      setActifs((prev) => [...prev, moduleId]);
    }

    setBusyId(null);
    onChange?.();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Gérer les modules</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            Fermer
          </button>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
        ) : (
          <>
            <p className="panel-hint">
              {Number.isFinite(limite) ? `${compte} / ${limite} modules activés` : `${compte} module${compte > 1 ? "s" : ""} activé${compte > 1 ? "s" : ""} (illimité)`}
            </p>

            {limite === 0 && (
              <p className="settings-msg err">
                Aucun forfait actif — <Link href="/parametres" style={{ color: "inherit", textDecoration: "underline" }}>choisis un forfait</Link> pour activer des modules.
              </p>
            )}

            <div className="modules-picker-grid">
              {MODULES.map((mod) => {
                const estActif = actifs.includes(mod.id);
                const bloque = !estActif && compte >= limite;
                return (
                  <button
                    key={mod.id}
                    className={`modules-picker-tile${estActif ? " active" : ""}${bloque ? " disabled" : ""}`}
                    onClick={() => !bloque && handleToggle(mod.id)}
                    disabled={busyId === mod.id || bloque}
                    title={bloque ? "Limite de modules atteinte pour ton forfait" : mod.nom}
                  >
                    <img src={mod.image} alt={mod.nom} />
                    {estActif && <span className="modules-picker-check">✓</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
