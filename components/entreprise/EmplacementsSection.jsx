"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function EmplacementsSection({ entrepriseId }) {
  const [emplacements, setEmplacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editNom, setEditNom] = useState("");

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("emplacements")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true });
    setEmplacements(data || []);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    await supabase.from("emplacements").insert({ entreprise_id: entrepriseId, nom: nom.trim() });
    setNom("");
    load();
  }

  function startEdit(emp) {
    setEditingId(emp.id);
    setEditNom(emp.nom);
  }

  async function handleSaveEdit(id) {
    if (!editNom.trim()) return;
    await supabase.from("emplacements").update({ nom: editNom.trim() }).eq("id", id);
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("emplacements").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Emplacements</h2>
      <p className="panel-hint">
        Tes succursales. Dès qu'il y en a plus d'une, l'Horaire et le Pointage se gèrent séparément pour chacune.
      </p>

      <div className="admin-list" style={{ marginBottom: "20px", maxWidth: "500px" }}>
        {emplacements.map((emp) => (
          <div className="admin-row" key={emp.id}>
            {editingId === emp.id ? (
              <input type="text" value={editNom} onChange={(e) => setEditNom(e.target.value)} style={{ flex: 1 }} />
            ) : (
              <div className="admin-row-main">
                <div className="admin-row-title">{emp.nom}</div>
              </div>
            )}

            <div className="admin-row-controls">
              {editingId === emp.id ? (
                <>
                  <button className="admin-icon-btn" onClick={() => handleSaveEdit(emp.id)}>
                    Enregistrer
                  </button>
                  <button className="admin-icon-btn" onClick={() => setEditingId(null)}>
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <button className="admin-icon-btn" onClick={() => startEdit(emp)}>
                    Modifier
                  </button>
                  <button className="admin-icon-btn danger" onClick={() => handleDelete(emp.id)}>
                    Retirer
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {emplacements.length === 0 && <div className="admin-empty">Un seul emplacement implicite pour l'instant.</div>}
      </div>

      <form className="admin-add-form" onSubmit={handleAdd}>
        <input type="text" placeholder="Nom de la succursale" value={nom} onChange={(e) => setNom(e.target.value)} required />
        <button type="submit" className="btn-small">
          Ajouter
        </button>
      </form>
    </div>
  );
}
