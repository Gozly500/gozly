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

function formatDuree(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
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
      .gte("horodatage", weekStart.toISOString())
      .lt("horodatage", weekEnd.toISOString())
      .order("horodatage", { ascending: true });

    setEmployes(employesData || []);
    setPointages(pointagesData || []);
    setLoading(false);
  }

  function sessionsPour(employeId) {
    const points = pointages.filter((p) => p.employe_id === employeId);
    const sessions = [];
    let arrivee = null;

    for (const p of points) {
      if (p.type === "arrivee") {
        arrivee = p;
      } else if (p.type === "depart" && arrivee) {
        const minutes = (new Date(p.horodatage) - new Date(arrivee.horodatage)) / 60000;
        sessions.push({ debut: arrivee.horodatage, fin: p.horodatage, minutes });
        arrivee = null;
      }
    }
    if (arrivee) {
      sessions.push({ debut: arrivee.horodatage, fin: null, minutes: (Date.now() - new Date(arrivee.horodatage)) / 60000 });
    }
    return sessions;
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

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : employes.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>Aucun employé pour l'instant.</p>
      ) : (
        <div className="planning-days">
          {employes.map((emp) => {
            const sessions = sessionsPour(emp.id);
            const total = sessions.reduce((sum, s) => sum + s.minutes, 0);

            return (
              <div className="planning-day" key={emp.id}>
                <div className="planning-day-head">
                  <span className="planning-day-title">{emp.nom}</span>
                  <span className="planning-day-date">{formatDuree(total)} cette semaine</span>
                </div>

                {sessions.map((s, i) => (
                  <div className="planning-quart" key={i}>
                    <div>
                      <div className="planning-quart-employe">
                        {new Date(s.debut).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "short" })}
                      </div>
                      <div className="planning-quart-heures">
                        {new Date(s.debut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {s.fin
                          ? new Date(s.fin).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })
                          : "en cours"}
                        {" · "}
                        {formatDuree(s.minutes)}
                      </div>
                    </div>
                  </div>
                ))}

                {sessions.length === 0 && <p style={{ color: "var(--text-dim)", fontSize: "13px" }}>Aucun pointage.</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
