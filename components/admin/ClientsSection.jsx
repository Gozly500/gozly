"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const FORFAITS = [
  { id: "", label: "Aucun forfait" },
  { id: "opale", label: "Opale" },
  { id: "onyx", label: "Onyx" },
  { id: "crystal", label: "Crystal" },
];

async function authFetch(path, options = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function ClientsSection() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [resetResult, setResetResult] = useState({});
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    const { ok, data } = await authFetch("/api/admin/clients");
    if (!ok) {
      setError(data.error || "Impossible de charger la liste des clients.");
      setLoading(false);
      return;
    }
    setRows(data.rows || []);
    setLoading(false);
  }

  async function handleForfaitChange(entrepriseId, forfait) {
    setRows((prev) =>
      prev.map((r) =>
        r.entreprise.id === entrepriseId ? { ...r, entreprise: { ...r.entreprise, forfait: forfait || null } } : r
      )
    );
    await supabase.from("entreprises").update({ forfait: forfait || null }).eq("id", entrepriseId);
  }

  async function handleToggleActif(profilId, desactive) {
    setRows((prev) => prev.map((r) => (r.profil?.id === profilId ? { ...r, profil: { ...r.profil, desactive } } : r)));
    await supabase.from("profils").update({ desactive }).eq("id", profilId);
  }

  function startEdit(row) {
    setEditingId(row.entreprise.id);
    setEditForm({
      fullName: row.profil?.full_name || "",
      telephonePerso: row.profil?.telephone_perso || "",
      entrepriseNom: row.entreprise.nom || "",
      telephone: row.entreprise.telephone || "",
      courrielContact: row.entreprise.courriel_contact || "",
      adresse: row.entreprise.adresse || "",
      email: row.email || "",
    });
    setResetResult((prev) => ({ ...prev, [row.entreprise.id]: null }));
    setConfirmingDelete(false);
    setDeleteConfirmText("");
  }

  async function handleDeleteClient(row) {
    setDeleting(true);
    const { ok, data } = await authFetch("/api/admin/delete-client", {
      method: "POST",
      body: JSON.stringify({ profilId: row.profil?.id || null, entrepriseId: row.entreprise.id }),
    });
    setDeleting(false);

    if (!ok) {
      setError(data.error || "La suppression a échoué.");
      return;
    }

    setError(null);
    setEditingId(null);
    setRows((prev) => prev.filter((r) => r.entreprise.id !== row.entreprise.id));
  }

  async function handleSaveEdit(row) {
    setSaving(true);
    const { ok, data } = await authFetch("/api/admin/clients", {
      method: "PATCH",
      body: JSON.stringify({
        profilId: row.profil?.id || null,
        entrepriseId: row.entreprise.id,
        ...editForm,
      }),
    });
    setSaving(false);

    if (!ok) {
      setError(data.error || "La mise à jour a échoué.");
      return;
    }

    setError(null);
    setEditingId(null);
    load();
  }

  async function handleResetPassword(row) {
    if (!row.profil) return;
    setResetResult((prev) => ({ ...prev, [row.entreprise.id]: "..." }));
    const { ok, data } = await authFetch("/api/admin/reset-password", {
      method: "POST",
      body: JSON.stringify({ userId: row.profil.id }),
    });
    setResetResult((prev) => ({
      ...prev,
      [row.entreprise.id]: ok ? data.password : data.error || "Échec",
    }));
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Clients</h2>
      <p className="panel-hint">Toutes les entreprises inscrites sur Gozly ({rows.length}).</p>
      {error && <p className="settings-msg err">{error}</p>}

      <div className="admin-list">
        {rows.map((row) => (
          <div className="admin-row" key={row.entreprise.id} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <div className="admin-row-main">
                <div className="admin-row-title">{row.entreprise.nom}</div>
                <div className="admin-row-sub">
                  {row.email || "Aucun compte lié"} · inscrit le{" "}
                  {new Date(row.entreprise.created_at).toLocaleDateString("fr-CA")}
                </div>
              </div>

              <div className="admin-row-controls">
                <select
                  className="admin-select"
                  value={row.entreprise.forfait || ""}
                  onChange={(e) => handleForfaitChange(row.entreprise.id, e.target.value)}
                >
                  {FORFAITS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>

                {row.profil ? (
                  <label className="switch" title={row.profil.desactive ? "Compte désactivé" : "Compte actif"}>
                    <input
                      type="checkbox"
                      checked={!row.profil.desactive}
                      onChange={(e) => handleToggleActif(row.profil.id, !e.target.checked)}
                    />
                    <span className="switch-track"></span>
                    <span className="switch-thumb"></span>
                  </label>
                ) : (
                  <span className="admin-status-pill inactive">Sans compte</span>
                )}

                <button
                  className="admin-icon-btn"
                  onClick={() => (editingId === row.entreprise.id ? setEditingId(null) : startEdit(row))}
                >
                  {editingId === row.entreprise.id ? "Fermer" : "Modifier"}
                </button>
              </div>
            </div>

            {editingId === row.entreprise.id && (
              <div className="admin-edit-panel">
                <div className="field-row">
                  <div className="field">
                    <label>Nom du client</label>
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Nom de l'entreprise</label>
                    <input
                      type="text"
                      value={editForm.entrepriseNom}
                      onChange={(e) => setEditForm((f) => ({ ...f, entrepriseNom: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Courriel de connexion</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      disabled={!row.profil}
                    />
                  </div>
                  <div className="field">
                    <label>Courriel de contact (entreprise)</label>
                    <input
                      type="email"
                      value={editForm.courrielContact}
                      onChange={(e) => setEditForm((f) => ({ ...f, courrielContact: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Téléphone de l'entreprise</label>
                    <input
                      type="tel"
                      value={editForm.telephone}
                      onChange={(e) => setEditForm((f) => ({ ...f, telephone: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Téléphone personnel</label>
                    <input
                      type="tel"
                      value={editForm.telephonePerso}
                      onChange={(e) => setEditForm((f) => ({ ...f, telephonePerso: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Adresse</label>
                  <input
                    type="text"
                    value={editForm.adresse}
                    onChange={(e) => setEditForm((f) => ({ ...f, adresse: e.target.value }))}
                  />
                </div>

                <div className="admin-edit-actions">
                  <button className="submit-btn" onClick={() => handleSaveEdit(row)} disabled={saving}>
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </button>
                  {row.profil && (
                    <button className="admin-icon-btn" onClick={() => handleResetPassword(row)}>
                      Réinitialiser le mot de passe
                    </button>
                  )}
                </div>

                {resetResult[row.entreprise.id] && (
                  <div className="admin-reset-result">
                    Nouveau mot de passe temporaire : <strong>{resetResult[row.entreprise.id]}</strong>
                    <br />
                    Transmets-le au client de vive voix — il ne sera plus affiché une fois cette page quittée.
                  </div>
                )}

                <div className="settings-divider">Zone dangereuse</div>

                {!confirmingDelete ? (
                  <div className="danger-zone">
                    <div>
                      <h4>Supprimer ce compte</h4>
                      <p>Efface définitivement le compte, l'entreprise et toutes ses données (planning, employés, etc).</p>
                    </div>
                    <button className="btn-danger" onClick={() => setConfirmingDelete(true)}>
                      Supprimer le compte
                    </button>
                  </div>
                ) : (
                  <div className="danger-zone" style={{ flexDirection: "column", alignItems: "stretch", gap: "12px" }}>
                    <div>
                      <h4>Confirmer la suppression</h4>
                      <p>
                        Tape le nom de l'entreprise (<strong>{row.entreprise.nom}</strong>) pour confirmer. Cette
                        action est irréversible.
                      </p>
                    </div>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={row.entreprise.nom}
                    />
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        className="btn-danger"
                        disabled={deleteConfirmText !== row.entreprise.nom || deleting}
                        onClick={() => handleDeleteClient(row)}
                      >
                        {deleting ? "Suppression..." : "Confirmer la suppression définitive"}
                      </button>
                      <button
                        className="admin-icon-btn"
                        onClick={() => {
                          setConfirmingDelete(false);
                          setDeleteConfirmText("");
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {rows.length === 0 && <div className="admin-empty">Aucun client pour l'instant.</div>}
      </div>
    </div>
  );
}
