"use client";

import { useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { getDebutSemaine, addDays } from "@/lib/semaine";
import RappelNotifications from "@/components/moi/RappelNotifications";
import PointageMobileBloc from "@/components/moi/PointageMobileBloc";
import { useLangue } from "@/components/moi/LangueContext";
import { localeDate } from "@/lib/i18n/moi";
import { IconFlecheDroite, IconFlecheGauche } from "@/components/icons/Pictogrammes";

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
  const { t, langue } = useLangue();
  const [weekStart, setWeekStart] = useState(() => getDebutSemaine(new Date()));
  const [quarts, setQuarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joursOuverts, setJoursOuverts] = useState({});
  const [pointageActif, setPointageActif] = useState(false);
  const [enPoste, setEnPoste] = useState(false);
  const [pointageOuvert, setPointageOuvert] = useState(false);

  // Le bouton Pointer est toujours là (même sans quart prévu) si le pointage mobile est activé.
  async function chargerEtatPointage() {
    try {
      const res = await employeFetch("/api/employe-app/pointage-mobile");
      if (!res.ok) return;
      const data = await res.json();
      setPointageActif(!!data.actif);
      setEnPoste(!!data.pointageOuvert);
    } catch {}
  }

  useEffect(() => {
    chargerEtatPointage();
  }, []);

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

  const weekLabel = `${weekStart.toLocaleDateString(localeDate(langue), { day: "numeric", month: "long" })} - ${addDays(
    weekStart,
    6
  ).toLocaleDateString(localeDate(langue), { day: "numeric", month: "long" })}`;

  const jours = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="moi-horaire">
      <RappelNotifications types={["notif_semaine_publiee"]} sujet="horaire" />
      {pointageActif && (
        <button type="button" className="moi-pointer-flottant" onClick={() => setPointageOuvert(true)}>
          {enPoste ? t("pointage.terminer") : t("pointage.pointer")}
        </button>
      )}
      {pointageOuvert && (
        <div
          className="modal-overlay"
          onClick={() => {
            setPointageOuvert(false);
            chargerEtatPointage();
          }}
        >
          <div style={{ width: "100%", maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <PointageMobileBloc
              forcer
              onTermine={() => {
                setPointageOuvert(false);
                chargerEtatPointage();
              }}
            />
          </div>
        </div>
      )}
      <div className="moi-week-nav">
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          <IconFlecheGauche className="gozly-icon" />
        </button>
        <span className="moi-week-label">{weekLabel}</span>
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          <IconFlecheDroite className="gozly-icon" />
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>{t("nav.chargement")}</p>
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
                    {jour.toLocaleDateString(localeDate(langue), { weekday: "long", day: "numeric", month: "long" })}
                  </div>
                  {quartsDuJour.length > 0 && (
                    <button
                      type="button"
                      className="moi-jour-toggle"
                      aria-expanded={!!ouvert}
                      onClick={() => setJoursOuverts((cur) => ({ ...cur, [dateISO]: !cur[dateISO] }))}
                    >
                      {ouvert ? t("horaire.masquer") : t("horaire.afficher")}
                    </button>
                  )}
                </div>
                {quartsDuJour.length === 0 ? (
                  <p className="moi-jour-repos">{t("horaire.repos")}</p>
                ) : (
                  quartsDuJour.map((q) => (
                    <div key={q.id}>
                      <div className="moi-quart">
                        {heure(q.heure_debut)} – {heure(q.heure_fin)}
                        {q.echange_de_nom && <span className="moi-quart-echange">{t("horaire.echange")}</span>}
                      </div>
                      {ouvert && (
                        <div className="moi-quart-detail">
                          <div className="moi-detail-ligne">
                            <span>{t("horaire.duree")}</span>
                            <strong>{duree(q.heure_debut, q.heure_fin) || "—"}</strong>
                          </div>
                          {q.emplacement_nom && (
                            <div className="moi-detail-ligne">
                              <span>{t("horaire.succursale")}</span>
                              <strong>{q.emplacement_nom}</strong>
                            </div>
                          )}
                          {q.echange_de_nom && (
                            <div className="moi-detail-ligne">
                              <span>{t("horaire.echange")}</span>
                              <strong>{t("horaire.echangeDe", { nom: q.echange_de_nom })}</strong>
                            </div>
                          )}
                          {q.poste && (
                            <div className="moi-detail-ligne">
                              <span>{t("horaire.poste")}</span>
                              <strong>{q.poste}</strong>
                            </div>
                          )}
                          <div className="moi-detail-titre">{t("horaire.avecQui")}</div>
                          {q.collegues.length === 0 ? (
                            <p className="moi-jour-repos">{t("horaire.personne")}</p>
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
