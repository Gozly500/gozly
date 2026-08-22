"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const FORM_VIDE = { nom: "", role: "", telephone: "", courriel: "", nip: "", numeroPaie: "", emplacementIds: [] };

export default function EmployesSection({ entrepriseId }) {
  const [employes, setEmployes] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [associations, setAssociations] = useState([]); // { employe_id, emplacement_id }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VIDE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const [employesRes, emplacementsRes] = await Promise.all([
      supabase.from("employes").select("*").eq("entreprise_id", entrepriseId).order("nom", { ascending: true }),
      supabase.from("emplacements").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
    ]);

    const employesData = employesRes.data || [];
    setEmployes(employesData);
    setEmplacements(emplacementsRes.data || []);

    if (employesData.length > 0) {
      const { data: assocData } = await supabase
        .from("employe_emplacements")
        .select("*")
        .in("employe_id", employesData.map((e) => e.id));
      setAssociations(assocData || []);
    } else {
      setAssociations([]);
    }

    setLoading(false);
  }

  function emplacementsDe(employeId) {
    return associations.filter((a) => a.employe_id === employeId).map((a) => a.emplacement_id);
  }

  function openAdd() {
    setEditingId(null);
    setForm(FORM_VIDE);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(emp) {
    setEditingId(emp.id);
    setForm({
      nom: emp.nom,
      role: emp.role || "",
      telephone: emp.telephone || "",
      courriel: emp.courriel || "",
      nip: emp.nip || "",
      numeroPaie: emp.numero_paie || "",
      emplacementIds: emplacementsDe(emp.id),
    });
    setError(null);
    setModalOpen(true);
  }

  function toggleEmplacement(id) {
    setForm((f) => ({
      ...f,
      emplacementIds: f.emplacementIds.includes(id)
        ? f.emplacementIds.filter((e) => e !== id)
        : [...f.emplacementIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nom.trim()) return;
    setSaving(true);
    setError(null);

    const payload = {
      nom: form.nom.trim(),
      role: form.role.trim() || null,
      telephone: form.telephone.trim() || null,
      courriel: form.courriel.trim() || null,
      nip: form.nip.trim() || null,
      numero_paie: form.numeroPaie.trim() || null,
    };

    let employeId = editingId;

    if (editingId) {
      const { error } = await supabase.from("employes").update(payload).eq("id", editingId);
      if (error) {
        setSaving(false);
        setError(error.code === "23505" ? "Ce NIP est déjà utilisé par un autre employé." : "La mise à jour a échoué.");
        return;
      }
      await supabase.from("employe_emplacements").delete().eq("employe_id", editingId);
    } else {
      const { data, error } = await supabase
        .from("employes")
        .insert({ entreprise_id: entrepriseId, ...payload })
        .select()
        .single();
      if (error) {
        setSaving(false);
        setError(error.code === "23505" ? "Ce NIP est déjà utilisé par un autre employé." : "L'ajout a échoué.");
        return;
      }
      employeId = data.id;
    }

    if (form.emplacementIds.length > 0) {
      await supabase
        .from("employe_emplacements")
        .insert(form.emplacementIds.map((emplacement_id) => ({ employe_id: employeId, emplacement_id })));
    }

    setSaving(false);
    setModalOpen(false);
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2>Employés</h2>
          <p className="panel-hint">La fiche de tes employés, partagée par tous les modules qui en ont besoin.</p>
        </div>
        <button className="submit-btn" onClick={openAdd}>
          + Ajouter un employé
        </button>
      </div>

      <div className="admin-list" style={{ maxWidth: "640px" }}>
        {employes.map((emp) => {
          const empEmplacements = emplacementsDe(emp.id)
            .map((id) => emplacements.find((e) => e.id === id)?.nom)
            .filter(Boolean);
          return (
            <div className="admin-row" key={emp.id}>
              <div className="admin-row-main">
                <div className="admin-row-title">{emp.nom}</div>
                <div className="admin-row-sub">
                  {[emp.role, emp.telephone, emp.courriel, emp.numero_paie && `# paie: ${emp.numero_paie}`]
                    .filter(Boolean)
                    .join(" · ") || "Aucune info de contact"}
                  {empEmplacements.length > 0 && ` · 📍 ${empEmplacements.join(", ")}`}
                </div>
              </div>
              <div className="admin-row-controls">
                <button className="admin-icon-btn" onClick={() => openEdit(emp)}>
                  Modifier
                </button>
                <button className="admin-icon-btn danger" onClick={() => handleDelete(emp.id)}>
                  Retirer
                </button>
              </div>
            </div>
          );
        })}
        {employes.length === 0 && <div className="admin-empty">Aucun employé pour l'instant.</div>}
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingId ? "Modifier l'employé" : "Ajouter un employé"}</h3>
              <button className="admin-icon-btn" onClick={() => setModalOpen(false)}>
                Fermer
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field-row">
                <div className="field">
                  <label>Nom</label>
                  <input
                    type="text"
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    placeholder="Nom de l'employé"
                    required
                  />
                </div>
                <div className="field">
                  <label>Rôle (optionnel)</label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    placeholder="Ex: cuisinier"
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label>Téléphone (optionnel)</label>
                  <input
                    type="tel"
                    value={form.telephone}
                    onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                    placeholder="(514) 000-0000"
                  />
                </div>
                <div className="field">
                  <label>Courriel (optionnel)</label>
                  <input
                    type="email"
                    value={form.courriel}
                    onChange={(e) => setForm((f) => ({ ...f, courriel: e.target.value }))}
                    placeholder="employe@courriel.com"
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field" style={{ maxWidth: "140px" }}>
                  <label>NIP (optionnel)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.nip}
                    onChange={(e) => setForm((f) => ({ ...f, nip: e.target.value.replace(/\D/g, "") }))}
                    placeholder="1234"
                  />
                </div>
                <div className="field">
                  <label>Numéro d'employé - paie (optionnel)</label>
                  <input
                    type="text"
                    value={form.numeroPaie}
                    onChange={(e) => setForm((f) => ({ ...f, numeroPaie: e.target.value }))}
                    placeholder="Ex: 42 (numéro dans Nethris)"
                  />
                </div>
              </div>
              <p className="section-hint" style={{ marginTop: "-8px", marginBottom: "14px" }}>
                Utilisé pour faire correspondre l'employé lors de l'exportation vers un service de paie (Nethris, etc.).
              </p>

              {emplacements.length > 0 && (
                <div className="field">
                  <label>Emplacements</label>
                  <div className="emplacement-checks">
                    {emplacements.map((e) => (
                      <label key={e.id} className="emplacement-check">
                        <input
                          type="checkbox"
                          checked={form.emplacementIds.includes(e.id)}
                          onChange={() => toggleEmplacement(e.id)}
                        />
                        📍 {e.nom}
                      </label>
                    ))}
                  </div>
                  <p className="section-hint" style={{ marginTop: "6px" }}>
                    Aucune case cochée = disponible partout.
                  </p>
                </div>
              )}

              {error && <p className="settings-msg err">{error}</p>}

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
