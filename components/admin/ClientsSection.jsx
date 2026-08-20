"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const FORFAITS = [
  { id: "", label: "Aucun forfait" },
  { id: "opale", label: "Opale" },
  { id: "onyx", label: "Onyx" },
  { id: "crystal", label: "Crystal" },
];

export default function ClientsSection() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const { data: entreprises } = await supabase
      .from("entreprises")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: profils } = await supabase.from("profils").select("*");

    const combined = (entreprises || []).map((entreprise) => {
      const profil = (profils || []).find((p) => p.entreprise_id === entreprise.id);
      return { entreprise, profil };
    });

    setRows(combined);
    setLoading(false);
  }

  async function handleForfaitChange(entrepriseId, forfait) {
    setRows((prev) =>
      prev.map((r) => (r.entreprise.id === entrepriseId ? { ...r, entreprise: { ...r.entreprise, forfait: forfait || null } } : r))
    );
    await supabase
      .from("entreprises")
      .update({ forfait: forfait || null })
      .eq("id", entrepriseId);
  }

  async function handleToggleActif(profilId, desactive) {
    setRows((prev) =>
      prev.map((r) => (r.profil?.id === profilId ? { ...r, profil: { ...r.profil, desactive } } : r))
    );
    await supabase.from("profils").update({ desactive }).eq("id", profilId);
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Clients</h2>
      <p className="panel-hint">Toutes les entreprises inscrites sur Gozly ({rows.length}).</p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Forfait</th>
              <th>Statut du compte</th>
              <th>Inscrit le</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ entreprise, profil }) => (
              <tr key={entreprise.id}>
                <td>{entreprise.nom}</td>
                <td>
                  <select
                    value={entreprise.forfait || ""}
                    onChange={(e) => handleForfaitChange(entreprise.id, e.target.value)}
                  >
                    {FORFAITS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {profil ? (
                    <label className="switch" style={{ verticalAlign: "middle" }}>
                      <input
                        type="checkbox"
                        checked={!profil.desactive}
                        onChange={(e) => handleToggleActif(profil.id, !e.target.checked)}
                      />
                      <span className="switch-track"></span>
                      <span className="switch-thumb"></span>
                    </label>
                  ) : (
                    <span className="admin-status-pill inactive">Aucun compte lié</span>
                  )}
                </td>
                <td style={{ color: "var(--text-dim)" }}>
                  {new Date(entreprise.created_at).toLocaleDateString("fr-CA")}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: "var(--text-dim)", textAlign: "center" }}>
                  Aucun client pour l'instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
