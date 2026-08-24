"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const FORM_VIDE = { nom: "", sku: "", quantite: "", seuilAlerte: "", notes: "" };

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function ProduitsSection({ entrepriseId }) {
  const [produits, setProduits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wixConnecte, setWixConnecte] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VIDE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    authHeaders().then((headers) =>
      fetch("/api/wix/statut", { headers })
        .then((res) => res.json())
        .then((data) => setWixConnecte(!!data.connecte))
        .catch(() => setWixConnecte(false))
    );
  }, [entrepriseId]);

  async function handleSyncWix() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/inventaire/synchroniser-wix", { method: "POST", headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) {
        setSyncMsg({ type: "err", text: data.error || "La synchronisation a échoué." });
      } else {
        setSyncMsg({ type: "ok", text: `${data.count} produit(s) synchronisé(s) depuis Wix.` });
        load();
      }
    } catch {
      setSyncMsg({ type: "err", text: "La synchronisation a échoué." });
    }
    setSyncing(false);
  }

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

  function openAdd() {
    setEditingId(null);
    setForm(FORM_VIDE);
    setModalOpen(true);
  }

  function openEdit(produit) {
    setEditingId(produit.id);
    setForm({
      nom: produit.nom,
      sku: produit.sku || "",
      quantite: String(produit.quantite),
      seuilAlerte: String(produit.seuil_alerte),
      notes: produit.notes || "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nom.trim()) return;
    setSaving(true);

    const valeurs = {
      nom: form.nom.trim(),
      sku: form.sku.trim() || null,
      quantite: Number(form.quantite) || 0,
      seuil_alerte: Number(form.seuilAlerte) || 0,
      notes: form.notes.trim() || null,
    };

    if (editingId) {
      await supabase.from("produits_inventaire").update({ ...valeurs, updated_at: new Date().toISOString() }).eq("id", editingId);
    } else {
      await supabase.from("produits_inventaire").insert({ entreprise_id: entrepriseId, ...valeurs });
    }

    setSaving(false);
    setModalOpen(false);
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
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div>
          <h2>Inventaire</h2>
          <p className="panel-hint" style={{ marginBottom: 0 }}>
            Tes produits, leurs quantités en stock et leur seuil d'alerte.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {wixConnecte && (
            <button className="admin-icon-btn" onClick={handleSyncWix} disabled={syncing}>
              {syncing ? "Synchronisation..." : "🔌 Synchroniser Wix"}
            </button>
          )}
          <button className="submit-btn" onClick={openAdd}>
            + Ajouter un produit
          </button>
        </div>
      </div>

      {syncMsg && <p className={`settings-msg ${syncMsg.type}`}>{syncMsg.text}</p>}

      <div className="admin-list" style={{ maxWidth: "700px" }}>
        {produits.map((p) => {
          const enAlerte = p.quantite <= p.seuil_alerte;
          return (
            <div className="admin-row" key={p.id}>
              <div className="admin-row-main">
                <div className="admin-row-title" style={enAlerte ? { color: "#ff9494" } : undefined}>
                  {p.nom} {p.source === "wix" && "🔌"} {enAlerte && "⚠️"}
                </div>
                <div className="admin-row-sub">
                  {p.sku && `SKU: ${p.sku} · `}
                  Quantité: {p.quantite} · Seuil d'alerte: {p.seuil_alerte}
                  {p.notes && ` · ${p.notes}`}
                </div>
              </div>
              <div className="admin-row-controls">
                <button className="admin-icon-btn" onClick={() => openEdit(p)}>
                  Modifier
                </button>
                <button className="admin-icon-btn danger" onClick={() => handleDelete(p.id)}>
                  Retirer
                </button>
              </div>
            </div>
          );
        })}
        {produits.length === 0 && <div className="admin-empty">Aucun produit pour l'instant.</div>}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingId ? "Modifier le produit" : "Ajouter un produit"}</h3>
              <button className="admin-icon-btn" onClick={() => setModalOpen(false)}>
                Fermer
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field-row">
                <div className="field">
                  <label>Nom du produit</label>
                  <input
                    type="text"
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    placeholder="Ex: T-shirt noir M"
                    required
                  />
                </div>
                <div className="field">
                  <label>SKU (optionnel)</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    placeholder="Ex: TSN-M"
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Quantité</label>
                  <input
                    type="number"
                    value={form.quantite}
                    onChange={(e) => setForm((f) => ({ ...f, quantite: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="field">
                  <label>Seuil d'alerte</label>
                  <input
                    type="number"
                    value={form.seuilAlerte}
                    onChange={(e) => setForm((f) => ({ ...f, seuilAlerte: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="field">
                <label>Notes (optionnel)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Ex: fournisseur, emplacement en entrepôt..."
                />
              </div>

              <div className="admin-edit-actions">
                <button type="submit" className="submit-btn" disabled={saving}>
                  {saving ? "Enregistrement..." : editingId ? "Enregistrer" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
