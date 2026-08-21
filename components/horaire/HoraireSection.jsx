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
  const [addingForDate, setAddingForDate] = useState(null);
  const [form, setForm] = useState({ employeId: "", heureDebut: "09:00", heureFin: "17:00" });
  const [editingId, setEditingId] = useState(null);

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

  function openAddForm(dateISO) {
    setAddingForDate(dateISO);
    setEditingId(null);
    setForm({ employeId: employes[0]?.id || "", heureDebut: "09:00", heureFin: "17:00" });
  }

  function openEditForm(quart) {
    setAddingForDate(quart.date);
    setEditingId(quart.id);
    setForm({
      employeId: quart.employe_id || "",
      heureDebut: quart.heure_debut.slice(0, 5),
      heureFin: quart.heure_fin.slice(0, 5),
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.employeId) return;

    if (editingId) {
      await supabase
        .from("planning_quarts")
        .update({ employe_id: form.employeId, heure_debut: form.heureDebut, heure_fin: form.heureFin })
        .eq("id", editingId);
    } else {
      await supabase.from("planning_quarts").insert({
        entreprise_id: entrepriseId,
        employe_id: form.employeId,
        date: addingForDate,
        heure_debut: form.heureDebut,
        heure_fin: form.heureFin,
      });
    }

    setAddingForDate(null);
    setEditingId(null);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("planning_quarts").delete().eq("id", id);
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
        <div className="planning-days">
          {weekDays.map((day) => {
            const dateISO = toISODate(day);
            const dayQuarts = quarts.filter((q) => q.date === dateISO);

            return (
              <div className="planning-day" key={dateISO}>
                <div className="planning-day-head">
                  <div>
                    <span className="planning-day-title">{JOURS[(day.getDay() + 6) % 7]}</span>{" "}
                    <span className="planning-day-date">
                      {day.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <button className="admin-icon-btn" onClick={() => openAddForm(dateISO)}>
                    + Ajouter un quart
                  </button>
                </div>

                {dayQuarts.map((q) => (
                  <div className="planning-quart" key={q.id}>
                    <div>
                      <div className="planning-quart-employe">{employeNom(q.employe_id)}</div>
                      <div className="planning-quart-heures">
                        {q.heure_debut.slice(0, 5)} - {q.heure_fin.slice(0, 5)}
                      </div>
                    </div>
                    <div className="planning-quart-actions">
                      <button className="admin-icon-btn" onClick={() => openEditForm(q)}>
                        Modifier
                      </button>
                      <button className="admin-icon-btn danger" onClick={() => handleDelete(q.id)}>
                        Retirer
                      </button>
                    </div>
                  </div>
                ))}

                {dayQuarts.length === 0 && addingForDate !== dateISO && (
                  <p style={{ color: "var(--text-dim)", fontSize: "13px" }}>Aucun quart.</p>
                )}

                {addingForDate === dateISO && (
                  <form className="admin-edit-panel" onSubmit={handleSubmit}>
                    <div className="field-row">
                      <div className="field">
                        <label>Employé</label>
                        <select
                          className="admin-select"
                          style={{ width: "100%" }}
                          value={form.employeId}
                          onChange={(e) => setForm((f) => ({ ...f, employeId: e.target.value }))}
                        >
                          {employes.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Début</label>
                        <input
                          type="time"
                          value={form.heureDebut}
                          onChange={(e) => setForm((f) => ({ ...f, heureDebut: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="field">
                        <label>Fin</label>
                        <input
                          type="time"
                          value={form.heureFin}
                          onChange={(e) => setForm((f) => ({ ...f, heureFin: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="admin-edit-actions">
                      <button type="submit" className="submit-btn">
                        {editingId ? "Enregistrer" : "Ajouter"}
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => {
                          setAddingForDate(null);
                          setEditingId(null);
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
