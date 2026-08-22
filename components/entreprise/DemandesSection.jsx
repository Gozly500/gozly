"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function heure(t) {
  return t ? t.slice(0, 5) : "";
}

export default function DemandesSection({ entrepriseId }) {
  const [conges, setConges] = useState([]);
  const [echanges, setEchanges] = useState([]);
  const [employes, setEmployes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const [{ data: congesData }, { data: echangesData }, { data: employesData }] = await Promise.all([
      supabase.from("demandes_conge").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: false }),
      supabase
        .from("demandes_echange")
        .select("*, planning_quarts(date, heure_debut, heure_fin)")
        .eq("entreprise_id", entrepriseId)
        .order("created_at", { ascending: false }),
      supabase.from("employes").select("id, nom").eq("entreprise_id", entrepriseId),
    ]);
    setConges(congesData || []);
    setEchanges(echangesData || []);
    setEmployes(employesData || []);
    setLoading(false);
  }

  function nomEmploye(id) {
    return employes.find((e) => e.id === id)?.nom || "Employé";
  }

  async function traiterConge(id, statut) {
    setBusyId(id);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await supabase
      .from("demandes_conge")
      .update({ statut, traite_par: session?.user?.id || null, traite_le: new Date().toISOString() })
      .eq("id", id);
    setBusyId(null);
    load();
  }

  async function traiterEchange(demande, approuve) {
    setBusyId(demande.id);
    await supabase
      .from("demandes_echange")
      .update({ statut_admin: approuve ? "approuve" : "refuse", traite_le: new Date().toISOString() })
      .eq("id", demande.id);

    if (approuve) {
      await supabase.from("planning_quarts").update({ employe_id: demande.employe_receveur_id }).eq("id", demande.quart_id);
    }
    setBusyId(null);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  const congesEnAttente = conges.filter((c) => c.statut === "en_attente");
  const congesTraites = conges.filter((c) => c.statut !== "en_attente");
  const echangesActionnables = echanges.filter((e) => e.statut_employe === "accepte" && e.statut_admin === "en_attente");
  const echangesAutres = echanges.filter((e) => !(e.statut_employe === "accepte" && e.statut_admin === "en_attente"));

  return (
    <div>
      <h2>Demandes</h2>
      <p className="panel-hint">Congés et échanges de quarts proposés par tes employés.</p>

      <div className="settings-section">
        <h3>Congés</h3>
        {congesEnAttente.length === 0 ? (
          <p className="section-hint">Aucune demande en attente.</p>
        ) : (
          <div className="admin-list" style={{ maxWidth: "640px", marginBottom: "18px" }}>
            {congesEnAttente.map((c) => (
              <div className="admin-row" key={c.id}>
                <div className="admin-row-main">
                  <div className="admin-row-title">{nomEmploye(c.employe_id)}</div>
                  <div className="admin-row-sub">
                    Du {new Date(c.date_debut).toLocaleDateString("fr-CA")} au {new Date(c.date_fin).toLocaleDateString("fr-CA")}
                    {c.raison && ` · ${c.raison}`}
                  </div>
                </div>
                <div className="admin-row-controls">
                  <button className="admin-icon-btn" onClick={() => traiterConge(c.id, "approuve")} disabled={busyId === c.id}>
                    Approuver
                  </button>
                  <button className="admin-icon-btn danger" onClick={() => traiterConge(c.id, "refuse")} disabled={busyId === c.id}>
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {congesTraites.length > 0 && (
          <div className="admin-list" style={{ maxWidth: "640px" }}>
            {congesTraites.map((c) => (
              <div className="admin-row" key={c.id}>
                <div className="admin-row-main">
                  <div className="admin-row-title">{nomEmploye(c.employe_id)}</div>
                  <div className="admin-row-sub">
                    Du {new Date(c.date_debut).toLocaleDateString("fr-CA")} au {new Date(c.date_fin).toLocaleDateString("fr-CA")} ·{" "}
                    {c.statut === "approuve" ? "✅ Approuvé" : "❌ Refusé"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Échanges de quart</h3>
        {echangesActionnables.length === 0 ? (
          <p className="section-hint">Aucun échange en attente de ton approbation.</p>
        ) : (
          <div className="admin-list" style={{ maxWidth: "640px", marginBottom: "18px" }}>
            {echangesActionnables.map((e) => (
              <div className="admin-row" key={e.id}>
                <div className="admin-row-main">
                  <div className="admin-row-title">
                    {nomEmploye(e.employe_donneur_id)} → {nomEmploye(e.employe_receveur_id)}
                  </div>
                  <div className="admin-row-sub">
                    {e.planning_quarts && (
                      <>
                        {new Date(e.planning_quarts.date).toLocaleDateString("fr-CA")} · {heure(e.planning_quarts.heure_debut)}–
                        {heure(e.planning_quarts.heure_fin)}
                      </>
                    )}
                    {" · les deux employés sont d'accord, en attente de ton approbation"}
                  </div>
                </div>
                <div className="admin-row-controls">
                  <button className="admin-icon-btn" onClick={() => traiterEchange(e, true)} disabled={busyId === e.id}>
                    Approuver
                  </button>
                  <button className="admin-icon-btn danger" onClick={() => traiterEchange(e, false)} disabled={busyId === e.id}>
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {echangesAutres.length > 0 && (
          <div className="admin-list" style={{ maxWidth: "640px" }}>
            {echangesAutres.map((e) => (
              <div className="admin-row" key={e.id}>
                <div className="admin-row-main">
                  <div className="admin-row-title">
                    {nomEmploye(e.employe_donneur_id)} → {nomEmploye(e.employe_receveur_id)}
                  </div>
                  <div className="admin-row-sub">
                    {e.planning_quarts && (
                      <>
                        {new Date(e.planning_quarts.date).toLocaleDateString("fr-CA")} · {heure(e.planning_quarts.heure_debut)}–
                        {heure(e.planning_quarts.heure_fin)} ·{" "}
                      </>
                    )}
                    {e.statut_employe === "en_attente" && "En attente de réponse de l'employé"}
                    {e.statut_employe === "refuse" && "❌ Refusé par l'employé"}
                    {e.statut_admin === "approuve" && "✅ Approuvé"}
                    {e.statut_admin === "refuse" && "❌ Refusé"}
                    {e.statut_admin === "non_requis" && "✅ Approuvé automatiquement"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
