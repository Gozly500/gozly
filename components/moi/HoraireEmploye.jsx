"use client";

import { useEffect, useState } from "react";
import ChargementAnimation from "@/components/moi/ChargementAnimation";
import { employeFetch } from "@/lib/employeAuth";
import { getDebutSemaine, addDays } from "@/lib/semaine";
import RappelNotifications from "@/components/moi/RappelNotifications";
import PointageMobileBloc from "@/components/moi/PointageMobileBloc";
import { useLangue } from "@/components/moi/LangueContext";
import { localeDate } from "@/lib/i18n/moi";
import RemplacantModal from "@/components/moi/RemplacantModal";
import { dateAujourdhui } from "@/lib/commandes";
import { IconFlecheDroite, IconFlecheGauche } from "@/components/icons/Pictogrammes";
import CartePaie, { Montant, montantDe, formatHeures } from "@/components/moi/CartePaie";
import CarteHeures from "@/components/moi/CarteHeures";
import { heureCommande } from "@/lib/commandes";

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
  const [remplacantQuart, setRemplacantQuart] = useState(null); // quart pour lequel on lance un appel de remplaçant
  const [quarts, setQuarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joursOuverts, setJoursOuverts] = useState({});
  const [pointageActif, setPointageActif] = useState(false);
  const [enPoste, setEnPoste] = useState(false);
  const [pointageOuvert, setPointageOuvert] = useState(false);
  const [paie, setPaie] = useState(null); // calculateur de paie (Paramètres > Paie) : null tant qu'il est désactivé
  const [cache, setCache] = useState(true); // montants cachés par défaut (points)
  const [heures, setHeures] = useState(null); // heures pointées de la semaine : { minutesTotal, jours, aDesPointages }

  // Heures réellement travaillées (pointages) ; se rafraîchit chaque minute pour suivre un pointage en cours.
  useEffect(() => {
    const semaine = weekStart.toISOString().slice(0, 10);
    let ignore = false;
    async function charger() {
      try {
        const res = await employeFetch(`/api/employe-app/heures?semaine=${semaine}`);
        const data = res.ok ? await res.json() : null;
        if (!ignore) setHeures(data);
      } catch {}
    }
    setHeures(null);
    charger();
    const id = setInterval(() => document.visibilityState === "visible" && charger(), 60000);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, [weekStart]);

  // Paie de la semaine affichée ; se rafraîchit chaque minute pour suivre un pointage en cours.
  useEffect(() => {
    const semaine = weekStart.toISOString().slice(0, 10);
    let ignore = false;
    async function charger() {
      try {
        const res = await employeFetch(`/api/employe-app/paie?semaine=${semaine}`);
        const data = res.ok ? await res.json() : null;
        if (!ignore) setPaie(data?.actif ? data : null);
      } catch {}
    }
    charger();
    const id = setInterval(() => document.visibilityState === "visible" && charger(), 60000);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, [weekStart]);

  // Confidentialité : les montants se recachent dès que l'app passe en arrière-plan.
  useEffect(() => {
    const surVisibilite = () => document.visibilityState === "hidden" && setCache(true);
    document.addEventListener("visibilitychange", surVisibilite);
    return () => document.removeEventListener("visibilitychange", surVisibilite);
  }, []);

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

      <CarteHeures heures={heures} />
      <CartePaie paie={paie} cache={cache} onBascule={() => setCache((c) => !c)} />

      {loading ? (
        <ChargementAnimation />
      ) : (
        <div className="moi-jours-list">
          {jours.map((jour) => {
            const dateISO = jour.toISOString().slice(0, 10);
            const quartsDuJour = quarts.filter((q) => q.date === dateISO);
            const ouvert = joursOuverts[dateISO];
            // Paie du jour : ce qui est gagné (jour passé ou en cours) ou prévu (jour à venir).
            const pj = paie?.taux != null ? paie.jours?.[dateISO] : null;
            const minutesJour = pj ? (dateISO <= dateAujourdhui() && pj.gagnees > 0 ? pj.gagnees : pj.prevues) : 0;
            return (
              <div className="moi-jour-card" key={dateISO}>
                <div className="moi-jour-head">
                  <div className="moi-jour-date">
                    {jour.toLocaleDateString(localeDate(langue), { weekday: "long", day: "numeric", month: "long" })}
                  </div>
                  {minutesJour > 0 && (
                    <span className="moi-jour-paie">
                      <Montant valeur={montantDe(minutesJour, paie.taux)} cache={cache} />
                    </span>
                  )}
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
                {/* Heures réellement travaillées ce jour-là (arrivée et départ pointés), même si le quart prévu était plus long. */}
                {heures?.jours?.[dateISO] && (
                  <div className="moi-jour-travaille">
                    <span>{t("heures.travaille")}</span>
                    <strong>
                      {formatHeures(heures.jours[dateISO].minutes)}
                      {heures.jours[dateISO].enCours && <em> · {t("heures.enCours")}</em>}
                    </strong>
                    <small>
                      {heures.jours[dateISO].plages
                        .map((p) => `${heureCommande(p.entree, localeDate(langue))} – ${p.sortie ? heureCommande(p.sortie, localeDate(langue)) : "…"}`)
                        .join(" · ")}
                    </small>
                  </div>
                )}
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
                          {q.date >= dateAujourdhui() && (
                            <button type="button" className="admin-icon-btn" style={{ marginTop: "10px", width: "100%" }} onClick={() => setRemplacantQuart(q)}>
                              {t("rem.cherche")}
                            </button>
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

      {remplacantQuart && <RemplacantModal quart={remplacantQuart} onClose={() => setRemplacantQuart(null)} />}
    </div>
  );
}
