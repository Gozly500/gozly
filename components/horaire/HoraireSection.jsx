"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export default function HoraireSection({ entrepriseId }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [employes, setEmployes] = useState([]);
  const [quarts, setQuarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [modal, setModal] = useState(null); // { date, employeId, quartId, heureDebut, heureFin }

  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    load();
  }, [entrepriseId, weekStart]);

  async function load() {
    setLoading(true);
    const { data: employesData } = await supabase
      .from("employes")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("nom", { ascending: true });

    const { data: quartsData } = await supabase
      .from("planning_quarts")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date", toISODate(weekStart))
      .lte("date", toISODate(weekEnd))
      .order("heure_debut", { ascending: true });

    setEmployes(employesData || []);
    setQuarts(quartsData || []);
    setLoading(false);
  }

  function employeNom(id) {
    return employes.find((e) => e.id === id)?.nom || "Employé retiré";
  }

  function handleDrop(e, dateISO) {
    e.preventDefault();
    setDragOverDate(null);
    const employeId = e.dataTransfer.getData("text/plain");
    if (!employeId) return;
    setModal({ date: dateISO, employeId, quartId: null, heureDebut: "09:00", heureFin: "17:00" });
  }

  function openAddViaButton(dateISO) {
    setModal({ date: dateISO, employeId: employes[0]?.id || "", quartId: null, heureDebut: "09:00", heureFin: "17:00" });
  }

  function openEdit(quart) {
    setModal({
      date: quart.date,
      employeId: quart.employe_id,
      quartId: quart.id,
      heureDebut: quart.heure_debut.slice(0, 5),
      heureFin: quart.heure_fin.slice(0, 5),
    });
  }

  async function handleSaveModal(e) {
    e.preventDefault();
    if (!modal.employeId) return;

    if (modal.quartId) {
      await supabase
        .from("planning_quarts")
        .update({ employe_id: modal.employeId, heure_debut: modal.heureDebut, heure_fin: modal.heureFin })
        .eq("id", modal.quartId);
    } else {
      await supabase.from("planning_quarts").insert({
        entreprise_id: entrepriseId,
        employe_id: modal.employeId,
        date: modal.date,
        heure_debut: modal.heureDebut,
        heure_fin: modal.heureFin,
      });
    }

    setModal(null);
    load();
  }

  async function handleDeleteModal() {
    if (!modal.quartId) return;
    await supabase.from("planning_quarts").delete().eq("id", modal.quartId);
    setModal(null);
    load();
  }

  const weekLabel = `${weekStart.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} - ${weekEnd.toLocaleDateString(
    "fr-CA",
    { day: "numeric", month: "long", year: "numeric" }
  )}`;

  return (
    <div>
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
      ) : employes.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>
          Ajoute d'abord des employés dans Entreprise → Employés pour pouvoir les placer dans l'horaire.
        </p>
      ) : (
        <>
          <p className="section-hint" style={{ marginBottom: "14px" }}>
            Glisse un employé sur une journée pour lui assigner un quart.
          </p>
          <div className="horaire-layout">
            <div className="horaire-employees">
              {employes.map((emp) => (
                <div
                  key={emp.id}
                  className="horaire-employee-pill"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", emp.id)}
                >
                  {emp.nom}
                </div>
              ))}
            </div>

            <div className="horaire-grid">
              {weekDays.map((day) => {
                const dateISO = toISODate(day);
                const dayQuarts = quarts.filter((q) => q.date === dateISO);

                return (
                  <div
                    key={dateISO}
                    className={`horaire-col${dragOverDate === dateISO ? " drag-over" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverDate(dateISO);
                    }}
                    onDragLeave={() => setDragOverDate((d) => (d === dateISO ? null : d))}
                    onDrop={(e) => handleDrop(e, dateISO)}
                  >
                    <div className="horaire-col-head">
                      <div className="horaire-col-day">{JOURS[(day.getDay() + 6) % 7]}</div>
                      <div className="horaire-col-date">{day.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}</div>
                    </div>

                    {dayQuarts.map((q) => (
                      <div className="horaire-chip" key={q.id} onClick={() => openEdit(q)}>
                        <div className="horaire-chip-nom">{employeNom(q.employe_id)}</div>
                        <div className="horaire-chip-heures">
                          {q.heure_debut.slice(0, 5)} - {q.heure_fin.slice(0, 5)}
                        </div>
                      </div>
                    ))}

                    <button className="horaire-col-add" onClick={() => openAddViaButton(dateISO)}>
                      + Ajouter
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" style={{ maxWidth: "360px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal.quartId ? "Modifier le quart" : "Nouveau quart"}</h3>
              <button className="admin-icon-btn" onClick={() => setModal(null)}>
                Fermer
              </button>
            </div>
            <form onSubmit={handleSaveModal}>
              <div className="field">
                <label>Employé</label>
                {modal.quartId || employes.find((e) => e.id === modal.employeId) ? (
                  <select
                    className="admin-select"
                    style={{ width: "100%" }}
                    value={modal.employeId}
                    onChange={(e) => setModal((m) => ({ ...m, employeId: e.target.value }))}
                  >
                    {employes.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nom}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontWeight: 600 }}>{employeNom(modal.employeId)}</div>
                )}
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Début</label>
                  <input
                    type="time"
                    value={modal.heureDebut}
                    onChange={(e) => setModal((m) => ({ ...m, heureDebut: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>Fin</label>
                  <input
                    type="time"
                    value={modal.heureFin}
                    onChange={(e) => setModal((m) => ({ ...m, heureFin: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="admin-edit-actions">
                <button type="submit" className="submit-btn">
                  {modal.quartId ? "Enregistrer" : "Ajouter"}
                </button>
                {modal.quartId && (
                  <button type="button" className="btn-danger" onClick={handleDeleteModal}>
                    Retirer ce quart
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
