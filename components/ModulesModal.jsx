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
  const [nomEntreprise, setNomEntreprise] = useState("");
  const [demandeVitrineStatut, setDemandeVitrineStatut] = useState("idle"); // idle | envoi | envoye | erreur

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);

    const { data: entreprise } = await supabase
      .from("entreprises")
      .select("forfait, nom")
      .eq("id", entrepriseId)
      .maybeSingle();

    const { data: modules } = await supabase
      .from("modules_actifs")
      .select("module")
      .eq("entreprise_id", entrepriseId);

    setForfait(entreprise?.forfait || null);
    setNomEntreprise(entreprise?.nom || "");
    setActifs((modules || []).map((m) => m.module));
    setLoading(false);
  }

  async function handleDemanderVitrine() {
    setDemandeVitrineStatut("envoi");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error } = await supabase.from("messages_contact").insert({
      nom: nomEntreprise || session?.user?.email,
      courriel: session?.user?.email,
      objet: "Demande de site vitrine",
      message: `L'entreprise "${nomEntreprise || entrepriseId}" (id: ${entrepriseId}) souhaite obtenir un site vitrine.`,
    });

    setDemandeVitrineStatut(error ? "erreur" : "envoye");
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
                    {mod.image ? (
                      <img src={mod.image} alt={mod.nom} />
                    ) : (
                      <div className="modules-picker-fallback">
                        <span>{mod.icon}</span>
                        <small>{mod.nom}</small>
                      </div>
                    )}
                    {estActif && <span className="modules-picker-check">✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="settings-divider">Autre service</div>
            <div className="switch-row">
              <div className="switch-row-text">
                <h4>◆ Site vitrine</h4>
                <p>Un site rapide, moderne et à ton image, propulsé par Wix - construit pour toi par l&apos;équipe Gozly.</p>
              </div>
              <button
                type="button"
                className="btn-small"
                onClick={handleDemanderVitrine}
                disabled={demandeVitrineStatut === "envoi" || demandeVitrineStatut === "envoye"}
              >
                {demandeVitrineStatut === "envoye"
                  ? "Demande envoyée ✓"
                  : demandeVitrineStatut === "envoi"
                  ? "Envoi..."
                  : "Demander"}
              </button>
            </div>
            {demandeVitrineStatut === "erreur" && (
              <p className="settings-msg err">La demande a échoué. Réessaie dans un instant.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
