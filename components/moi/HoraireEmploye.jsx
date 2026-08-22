"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { getDebutSemaine, addDays } from "@/lib/semaine";

export default function HoraireEmploye() {
  const [weekStart, setWeekStart] = useState(() => getDebutSemaine(new Date()));
  const [quarts, setQuarts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employeFetch("/api/employe-app/moi").then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      const dimanche = data.entreprise?.premierJourSemaine === "dimanche";
      setWeekStart((w) => getDebutSemaine(addDays(w, 3), dimanche));
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const semaine = weekStart.toISOString().slice(0, 10);
    employeFetch(`/api/employe-app/horaire?semaine=${semaine}`).then(async (res) => {
      const data = await res.json();
      setQuarts(data.quarts || []);
      setLoading(false);
    });
  }, [weekStart]);

  const weekLabel = `${weekStart.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} - ${addDays(
    weekStart,
    6
  ).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`;

  const jours = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="moi-horaire">
      <div className="moi-week-nav">
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          ‹
        </button>
        <span className="moi-week-label">{weekLabel}</span>
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          ›
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : (
        <div className="moi-jours-list">
          {jours.map((jour) => {
            const dateISO = jour.toISOString().slice(0, 10);
            const quartsDuJour = quarts.filter((q) => q.date === dateISO);
            return (
              <div className="moi-jour-card" key={dateISO}>
                <div className="moi-jour-date">
                  {jour.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
                </div>
                {quartsDuJour.length === 0 ? (
                  <p className="moi-jour-repos">Repos</p>
                ) : (
                  quartsDuJour.map((q) => (
                    <div className="moi-quart" key={q.id}>
                      {q.heure_debut.slice(0, 5)} – {q.heure_fin.slice(0, 5)}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
