"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SOURCES_VENTE } from "@/lib/modules";
import { getDebutSemaine, addDays } from "@/lib/semaine";

const FORM_VIDE = { source: "comptant", montant: "", date: "", description: "" };

function labelSource(id) {
  return SOURCES_VENTE.find((s) => s.id === id)?.label || id;
}

function formatMontant(n) {
  return n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

export default function VentesSection({ entrepriseId }) {
  const [weekStart, setWeekStart] = useState(() => getDebutSemaine(new Date()));
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VIDE);
  const [saving, setSaving] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  const weekEnd = addDays(weekStart, 7);

  useEffect(() => {
    supabase
      .from("entreprises")
      .select("premier_jour_semaine")
      .eq("id", entrepriseId)
      .maybeSingle()
      .then(({ data }) => {
        const dimanche = data?.premier_jour_semaine === "dimanche";
        setWeekStart((w) => getDebutSemaine(addDays(w, 3), dimanche));
      });
  }, [entrepriseId]);

  useEffect(() => {
    load();
  }, [entrepriseId, weekStart]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("ventes")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date", weekStart.toISOString().slice(0, 10))
      .lt("date", weekEnd.toISOString().slice(0, 10))
      .order("date", { ascending: false });
    setVentes(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...FORM_VIDE, date: new Date().toISOString().slice(0, 10) });
    setSourceOpen(false);
    setModalOpen(true);
  }

  function openEdit(vente) {
    setEditingId(vente.id);
    setForm({
      source: vente.source,
      montant: String(vente.montant),
      date: vente.date,
      description: vente.description || "",
    });
    setSourceOpen(false);
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const montant = Number(form.montant);
    if (!form.date || !montant) return;
    setSaving(true);

    const valeurs = {
      source: form.source,
      montant,
      date: form.date,
      description: form.description.trim() || null,
    };

    if (editingId) {
      await supabase.from("ventes").update(valeurs).eq("id", editingId);
    } else {
      await supabase.from("ventes").insert({ entreprise_id: entrepriseId, ...valeurs });
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("ventes").delete().eq("id", id);
    load();
  }

  const totauxParSource = SOURCES_VENTE.map((s) => ({
    ...s,
    total: ventes.filter((v) => v.source === s.id).reduce((sum, v) => sum + Number(v.montant), 0),
  })).filter((s) => s.total > 0);
  const totalGeneral = ventes.reduce((sum, v) => sum + Number(v.montant), 0);

  const weekLabel = `${weekStart.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} - ${addDays(
    weekStart,
    6
  ).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2>Suivi des ventes</h2>
          <p className="panel-hint" style={{ marginBottom: 0 }}>
            Toutes tes ventes, peu importe la source, au même endroit.
          </p>
        </div>
        <button className="submit-btn" onClick={openAdd}>
          + Ajouter une vente
        </button>
      </div>

      <div className="planning-week-nav">
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          ‹ Semaine précédente
        </button>
        <span className="planning-week-label">{weekLabel}</span>
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          Semaine suivante ›
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : (
        <>
          <div className="admin-list" style={{ maxWidth: "500px", marginBottom: "24px" }}>
            {totauxParSource.length === 0 ? (
              <div className="admin-empty">Aucune vente cette semaine.</div>
            ) : (
              <>
                {totauxParSource.map((s) => (
                  <div className="admin-row" key={s.id}>
                    <div className="admin-row-main">
                      <div className="admin-row-title">{s.label}</div>
                    </div>
                    <div className="admin-row-controls">{formatMontant(s.total)}</div>
                  </div>
                ))}
                <div className="admin-row">
                  <div className="admin-row-main">
                    <div className="admin-row-title">Total</div>
                  </div>
                  <div className="admin-row-controls" style={{ fontWeight: 700 }}>
                    {formatMontant(totalGeneral)}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="admin-list" style={{ maxWidth: "700px" }}>
            {ventes.map((v) => (
              <div className="admin-row" key={v.id}>
                <div className="admin-row-main">
                  <div className="admin-row-title">
                    {formatMontant(v.montant)} · {labelSource(v.source)}
                  </div>
                  <div className="admin-row-sub">
                    {new Date(v.date + "T00:00:00").toLocaleDateString("fr-CA", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    {v.description && ` · ${v.description}`}
                  </div>
                </div>
                <div className="admin-row-controls">
                  <button className="admin-icon-btn" onClick={() => openEdit(v)}>
                    Modifier
                  </button>
                  <button className="admin-icon-btn danger" onClick={() => handleDelete(v.id)}>
                    Retirer
                  </button>
                </div>
              </div>
            ))}
            {ventes.length === 0 && <div className="admin-empty">Aucune vente cette semaine.</div>}
          </div>
        </>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingId ? "Modifier la vente" : "Ajouter une vente"}</h3>
              <button className="admin-icon-btn" onClick={() => setModalOpen(false)}>
                Fermer
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field-row">
                <div className="field">
                  <label>Source</label>
                  <div className="emplacement-select-wrap" style={{ minWidth: 0 }}>
                    <div
                      className={`emplacement-select-trigger${sourceOpen ? " open" : ""}`}
                      onClick={() => setSourceOpen((v) => !v)}
                    >
                      <span>{labelSource(form.source)}</span>
                      <span className="fs-arrow">▾</span>
                    </div>
                    {sourceOpen && (
                      <div className="emplacement-select-options">
                        {SOURCES_VENTE.map((s) => (
                          <div
                            key={s.id}
                            className={`emplacement-select-option${s.id === form.source ? " active" : ""}`}
                            onClick={() => {
                              setForm((f) => ({ ...f, source: s.id }));
                              setSourceOpen(false);
                            }}
                          >
                            {s.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="field">
                  <label>Montant</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.montant}
                    onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>

              <div className="field">
                <label>Description (optionnel)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ex: référence de transaction"
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
