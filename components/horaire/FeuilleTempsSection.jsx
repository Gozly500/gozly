"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

function heuresDecimal(minutes) {
  return (minutes / 60).toFixed(2);
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export default function FeuilleTempsSection({ entrepriseId }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [employes, setEmployes] = useState([]);
  const [pointages, setPointages] = useState([]);
  const [loading, setLoading] = useState(true);

  const weekEnd = addDays(weekStart, 7);

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

    const { data: pointagesData } = await supabase
      .from("pointages")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("entree", weekStart.toISOString())
      .lt("entree", weekEnd.toISOString())
      .order("entree", { ascending: true });

    setEmployes(employesData || []);
    setPointages(pointagesData || []);
    setLoading(false);
  }

  function sessionsPour(employeId) {
    return pointages
      .filter((p) => p.employe_id === employeId)
      .map((p) => {
        const fin = p.sortie ? new Date(p.sortie) : new Date();
        return { debut: p.entree, fin: p.sortie, minutes: (fin - new Date(p.entree)) / 60000 };
      });
  }

  const lignes = employes.flatMap((emp) =>
    sessionsPour(emp.id).map((s) => ({ employe: emp.nom, ...s }))
  );

  function handleExport() {
    const header = ["Employe", "Date", "Debut", "Fin", "Heures"];
    const rows = lignes.map((l) => [
      l.employe,
      new Date(l.debut).toLocaleDateString("fr-CA"),
      new Date(l.debut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }),
      l.fin ? new Date(l.fin).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "",
      heuresDecimal(l.minutes),
    ]);

    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feuille-de-temps-${weekStart.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const weekLabel = `${weekStart.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} - ${addDays(
    weekStart,
    6
  ).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}`;

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

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "14px" }}>
        <button className="submit-btn" onClick={handleExport} disabled={lignes.length === 0}>
          ⬇ Exporter en CSV
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : lignes.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>Aucun pointage cette semaine.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Date</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Heures</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={i}>
                  <td>{l.employe}</td>
                  <td>{new Date(l.debut).toLocaleDateString("fr-CA")}</td>
                  <td>{new Date(l.debut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{l.fin ? new Date(l.fin).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "en cours"}</td>
                  <td>{heuresDecimal(l.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="section-hint" style={{ marginTop: "14px" }}>
        Le CSV contient une ligne par quart pointé (employé, date, heures). Si Sage 50 attend des colonnes
        différentes, tu peux ajuster le mappage directement dans son assistant d'importation.
      </p>
    </div>
  );
}
