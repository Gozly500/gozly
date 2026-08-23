"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const FORME_VIDE = { nom: "", sku: "", quantite: "", seuilAlerte: "", notes: "" };

export default function ProduitsSection({ entrepriseId }) {
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(FORME_VIDE);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(FORME_VIDE);

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("produits_inventaire")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true });
    setProduits(data || []);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.nom.trim()) return;
    await supabase.from("produits_inventaire").insert({
      entreprise_id: entrepriseId,
      nom: form.nom.trim(),
      sku: form.sku.trim() || null,
      quantite: Number(form.quantite) || 0,
      seuil_alerte: Number(form.seuilAlerte) || 0,
    });
    setForm(FORME_VIDE);
    load();
  }

  function startEdit(produit) {
    setEditingId(produit.id);
    setEditForm({
      nom: produit.nom,
      sku: produit.sku || "",
      quantite: String(produit.quantite),
      seuilAlerte: String(produit.seuil_alerte),
      notes: produit.notes || "",
    });
  }

  async function handleSaveEdit(id) {
    if (!editForm.nom.trim()) return;
    await supabase
      .from("produits_inventaire")
      .update({
        nom: editForm.nom.trim(),
        sku: editForm.sku.trim() || null,
        quantite: Number(editForm.quantite) || 0,
        seuil_alerte: Number(editForm.seuilAlerte) || 0,
        notes: editForm.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("produits_inventaire").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Inventaire</h2>
      <p className="panel-hint">Tes produits, leurs quantités en stock et leur seuil d'alerte.</p>

      <div className="admin-list" style={{ marginBottom: "20px", maxWidth: "700px" }}>
        {produits.map((p) => {
          const enAlerte = p.quantite <= p.seuil_alerte;
          return (
            <div className="admin-row" key={p.id}>
              {editingId === p.id ? (
                <div style={{ display: "flex", flex: 1, gap: "8px", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    value={editForm.nom}
                    onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })}
                    placeholder="Nom"
                    style={{ flex: 1, minWidth: "140px" }}
                  />
                  <input
                    type="text"
                    value={editForm.sku}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    placeholder="SKU"
                    style={{ width: "100px" }}
                  />
                  <input
                    type="number"
                    value={editForm.quantite}
                    onChange={(e) => setEditForm({ ...editForm, quantite: e.target.value })}
                    placeholder="Quantité"
                    style={{ width: "90px" }}
                  />
                  <input
                    type="number"
                    value={editForm.seuilAlerte}
                    onChange={(e) => setEditForm({ ...editForm, seuilAlerte: e.target.value })}
                    placeholder="Seuil d'alerte"
                    style={{ width: "110px" }}
                  />
                  <input
                    type="text"
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Notes"
                    style={{ flex: 1, minWidth: "140px" }}
                  />
                </div>
              ) : (
                <div className="admin-row-main">
                  <div className="admin-row-title" style={enAlerte ? { color: "#ff9494" } : undefined}>
                    {p.nom} {enAlerte && "⚠️"}
                  </div>
                  <div className="admin-row-sub">
                    {p.sku && `SKU: ${p.sku} · `}
                    Quantité: {p.quantite} · Seuil d'alerte: {p.seuil_alerte}
                    {p.notes && ` · ${p.notes}`}
                  </div>
                </div>
              )}

              <div className="admin-row-controls">
                {editingId === p.id ? (
                  <>
                    <button className="admin-icon-btn" onClick={() => handleSaveEdit(p.id)}>
                      Enregistrer
                    </button>
                    <button className="admin-icon-btn" onClick={() => setEditingId(null)}>
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <button className="admin-icon-btn" onClick={() => startEdit(p)}>
                      Modifier
                    </button>
                    <button className="admin-icon-btn danger" onClick={() => handleDelete(p.id)}>
                      Retirer
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {produits.length === 0 && <div className="admin-empty">Aucun produit pour l'instant.</div>}
      </div>

      <form className="admin-add-form" onSubmit={handleAdd} style={{ maxWidth: "600px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Nom du produit"
          value={form.nom}
          onChange={(e) => setForm({ ...form, nom: e.target.value })}
          required
          style={{ flex: 2, minWidth: "160px" }}
        />
        <input
          type="text"
          placeholder="SKU (optionnel)"
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
          style={{ flex: 1, minWidth: "100px" }}
        />
        <input
          type="number"
          placeholder="Quantité"
          value={form.quantite}
          onChange={(e) => setForm({ ...form, quantite: e.target.value })}
          style={{ width: "100px" }}
        />
        <input
          type="number"
          placeholder="Seuil d'alerte"
          value={form.seuilAlerte}
          onChange={(e) => setForm({ ...form, seuilAlerte: e.target.value })}
          style={{ width: "120px" }}
        />
        <button type="submit" className="btn-small">
          Ajouter
        </button>
      </form>
    </div>
  );
}
