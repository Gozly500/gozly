"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function EmployesSection({ entrepriseId }) {
  const [employes, setEmployes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");
  const [role, setRole] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editNom, setEditNom] = useState("");
  const [editRole, setEditRole] = useState("");

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("employes")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("nom", { ascending: true });
    setEmployes(data || []);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!nom.trim()) return;

    await supabase.from("employes").insert({ entreprise_id: entrepriseId, nom: nom.trim(), role: role.trim() || null });
    setNom("");
    setRole("");
    load();
  }

  function startEdit(emp) {
    setEditingId(emp.id);
    setEditNom(emp.nom);
    setEditRole(emp.role || "");
  }

  async function handleSaveEdit(id) {
    if (!editNom.trim()) return;
    await supabase.from("employes").update({ nom: editNom.trim(), role: editRole.trim() || null }).eq("id", id);
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("employes").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Employés</h2>
      <p className="panel-hint">La fiche de tes employés, partagée par tous les modules qui en ont besoin.</p>

      <div className="admin-list" style={{ marginBottom: "20px", maxWidth: "560px" }}>
        {employes.map((emp) => (
          <div className="admin-row" key={emp.id}>
            {editingId === emp.id ? (
              <div className="field-row" style={{ flex: 1, marginBottom: 0 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <input type="text" value={editNom} onChange={(e) => setEditNom(e.target.value)} placeholder="Nom" />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <input
                    type="text"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    placeholder="Rôle (optionnel)"
                  />
                </div>
              </div>
            ) : (
              <div className="admin-row-main">
                <div className="admin-row-title">{emp.nom}</div>
                {emp.role && <div className="admin-row-sub">{emp.role}</div>}
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
        {employes.length === 0 && <div className="admin-empty">Aucun employé pour l'instant.</div>}
      </div>

      <form className="field-row" onSubmit={handleAdd} style={{ maxWidth: "560px", alignItems: "flex-end" }}>
        <div className="field">
          <label>Nom</label>
          <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de l'employé" required />
        </div>
        <div className="field">
          <label>Rôle (optionnel)</label>
          <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex: cuisinier" />
        </div>
        <div className="field" style={{ flex: "0 0 auto" }}>
          <button type="submit" className="btn-small">
            Ajouter
          </button>
        </div>
      </form>
    </div>
  );
}
