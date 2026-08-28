"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CategoriesTemperatureSection({ entrepriseId }) {
  const [categories, setCategories] = useState([]);
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
      .from("categories_temperature")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true });
    setCategories(data || []);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    await supabase.from("categories_temperature").insert({ entreprise_id: entrepriseId, nom: nom.trim() });
    setNom("");
    load();
  }

  function startEdit(cat) {
    setEditingId(cat.id);
    setEditNom(cat.nom);
  }

  async function handleSaveEdit(id) {
    if (!editNom.trim()) return;
    await supabase.from("categories_temperature").update({ nom: editNom.trim() }).eq("id", id);
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("categories_temperature").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <p className="section-hint">Les catégories dans lesquelles tes équipements sont classés (ex: Frigos, Congélateurs).</p>

      <div className="admin-list" style={{ marginBottom: "20px", maxWidth: "500px" }}>
        {categories.map((cat) => (
          <div className="admin-row" key={cat.id}>
            {editingId === cat.id ? (
              <input type="text" value={editNom} onChange={(e) => setEditNom(e.target.value)} style={{ flex: 1 }} />
            ) : (
              <div className="admin-row-main">
                <div className="admin-row-title">{cat.nom}</div>
              </div>
            )}

            <div className="admin-row-controls">
              {editingId === cat.id ? (
                <>
                  <button className="admin-icon-btn" onClick={() => handleSaveEdit(cat.id)}>
                    Enregistrer
                  </button>
                  <button className="admin-icon-btn" onClick={() => setEditingId(null)}>
                    Annuler
                  </button>
                </>
              ) : (
                <>
                  <button className="admin-icon-btn" onClick={() => startEdit(cat)}>
                    Modifier
                  </button>
                  <button className="admin-icon-btn danger" onClick={() => handleDelete(cat.id)}>
                    Retirer
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {categories.length === 0 && <div className="admin-empty">Aucune catégorie pour l'instant.</div>}
      </div>

      <form className="admin-add-form" onSubmit={handleAdd}>
        <input type="text" placeholder="Nom de la catégorie" value={nom} onChange={(e) => setNom(e.target.value)} required />
        <button type="submit" className="btn-small">
          Ajouter
        </button>
      </form>
    </div>
  );
}
