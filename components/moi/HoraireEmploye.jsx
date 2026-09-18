"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { getDebutSemaine, addDays } from "@/lib/semaine";

function heure(t) {
  return t.slice(0, 5);
}

function duree(debut, fin) {
  const [h1, m1] = debut.split(":").map(Number);
  const [h2, m2] = fin.split(":").map(Number);
  const minutes = h2 * 60 + m2 - (h1 * 60 + m1);
  if (minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export default function HoraireEmploye() {
  const [weekStart, setWeekStart] = useState(() => getDebutSemaine(new Date()));
  const [quarts, setQuarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joursOuverts, setJoursOuverts] = useState({});

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
    setJoursOuverts({});
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
            const ouvert = joursOuverts[dateISO];
            return (
              <div className="moi-jour-card" key={dateISO}>
                <div className="moi-jour-head">
                  <div className="moi-jour-date">
                    {jour.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
                  </div>
                  {quartsDuJour.length > 0 && (
                    <button
                      type="button"
                      className="moi-jour-toggle"
                      aria-expanded={!!ouvert}
                      onClick={() => setJoursOuverts((cur) => ({ ...cur, [dateISO]: !cur[dateISO] }))}
                    >
                      {ouvert ? "Masquer" : "Afficher"}
                    </button>
                  )}
                </div>
                {quartsDuJour.length === 0 ? (
                  <p className="moi-jour-repos">Repos</p>
                ) : (
                  quartsDuJour.map((q) => (
                    <div key={q.id}>
                      <div className="moi-quart">
                        {heure(q.heure_debut)} – {heure(q.heure_fin)}
                      </div>
                      {ouvert && (
                        <div className="moi-quart-detail">
                          <div className="moi-detail-ligne">
                            <span>Durée</span>
                            <strong>{duree(q.heure_debut, q.heure_fin) || "—"}</strong>
                          </div>
                          {q.emplacement_nom && (
                            <div className="moi-detail-ligne">
                              <span>Succursale</span>
                              <strong>{q.emplacement_nom}</strong>
                            </div>
                          )}
                          {q.poste && (
                            <div className="moi-detail-ligne">
                              <span>Poste</span>
                              <strong>{q.poste}</strong>
                            </div>
                          )}
                          <div className="moi-detail-titre">Avec qui tu travailles</div>
                          {q.collegues.length === 0 ? (
                            <p className="moi-jour-repos">Personne d'autre de prévu sur ce quart.</p>
                          ) : (
                            q.collegues.map((c, i) => (
                              <div className="moi-detail-ligne" key={i}>
                                <span>
                                  {c.nom}
                                  {c.poste && <em> · {c.poste}</em>}
                                </span>
                                <strong>
                                  {heure(c.heure_debut)} – {heure(c.heure_fin)}
                                </strong>
                              </div>
                            ))
                          )}
                        </div>
                      )}
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
