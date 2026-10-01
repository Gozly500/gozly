"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Liste des tâches "modèles" d'une catégorie (ex: les sortes de pizza) -
// repliée sous chaque catégorie, voir JourEditor.jsx pour leur utilisation
// au moment de créer la journée.
function ModelesSection({ entrepriseId, categorieId }) {
  const [modeles, setModeles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");

  useEffect(() => {
    load();
  }, [categorieId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("taches_modeles")
      .select("*")
      .eq("categorie_id", categorieId)
      .order("created_at", { ascending: true });
    setModeles(data || []);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    await supabase.from("taches_modeles").insert({ entreprise_id: entrepriseId, categorie_id: categorieId, nom: nom.trim() });
    setNom("");
    load();
  }

  async function handleDelete(id) {
    await supabase.from("taches_modeles").delete().eq("id", id);
    load();
  }

  return (
    <div style={{ padding: "4px 20px 16px" }}>
      <p className="section-hint" style={{ marginBottom: "10px" }}>
        Les tâches qui reviennent chaque jour dans cette catégorie (ex: les sortes de pizza) - elles apparaîtront
        toutes prêtes, avec juste une courte note ou une quantité à écrire, quand tu crées une journée.
      </p>
      {!loading && modeles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
          {modeles.map((m) => (
            <span key={m.id} className="admin-status-pill" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {m.nom}
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                style={{ background: "none", border: "none", padding: 0, color: "inherit", cursor: "pointer", fontSize: "13px" }}
                title="Retirer"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <form className="admin-add-form" onSubmit={handleAdd} style={{ maxWidth: "none" }}>
        <input type="text" placeholder="Ex: Pizza Margherita" value={nom} onChange={(e) => setNom(e.target.value)} required />
        <button type="submit" className="btn-small">
          Ajouter
        </button>
      </form>
    </div>
  );
}

export default function CategoriesSection({ entrepriseId }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editNom, setEditNom] = useState("");
  const [modelesOuvertId, setModelesOuvertId] = useState(null);

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true });
    setCategories(data || []);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    await supabase.from("categories").insert({ entreprise_id: entrepriseId, nom: nom.trim() });
    setNom("");
    load();
  }

  function startEdit(cat) {
    setEditingId(cat.id);
    setEditNom(cat.nom);
  }

  async function handleSaveEdit(id) {
    if (!editNom.trim()) return;
    await supabase.from("categories").update({ nom: editNom.trim() }).eq("id", id);
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("categories").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Catégories</h2>
      <p className="panel-hint">Les catégories dans lesquelles tes tâches sont classées (ex: Cuisine, Ménage).</p>

      <div className="admin-list" style={{ marginBottom: "20px", maxWidth: "560px" }}>
        {categories.map((cat) => (
          <div className="admin-row" style={{ flexDirection: "column", alignItems: "stretch" }} key={cat.id}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              {editingId === cat.id ? (
                <input
                  type="text"
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  style={{ flex: 1 }}
                />
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
                    <button
                      className="admin-icon-btn"
                      onClick={() => setModelesOuvertId((cur) => (cur === cat.id ? null : cat.id))}
                    >
                      {modelesOuvertId === cat.id ? "Fermer" : "Tâches pré-enregistrées"}
                    </button>
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

            {modelesOuvertId === cat.id && <ModelesSection entrepriseId={entrepriseId} categorieId={cat.id} />}
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
