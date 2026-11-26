"use client";

import { IconFlecheDroite, IconFlecheGauche } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";
import { bloc, plageHeures, heureTexte } from "@/lib/horaireJour";

// La journée en ligne du temps : une rangée par employé, les heures en haut, chaque quart est un bloc.
// Un clic sur un bloc le modifie ; un clic dans une rangée ajoute un quart à cette heure-là.
export default function HoraireJour({ date, employes, quarts, onRetour, onJour, onAjouter, onModifier }) {
  const { t } = useT();
  const { debut, fin } = plageHeures(quarts);
  const heures = Array.from({ length: fin - debut }, (_, i) => debut + i);
  const total = (fin - debut) * 60;
  const pourcent = (minutes) => `${(minutes / total) * 100}%`;

  // Les employés à l'horaire d'abord (par heure d'arrivée), puis les autres.
  const rangees = employes
    .map((emp) => ({ emp, quarts: quarts.filter((q) => q.employe_id === emp.id).map((q) => ({ q, ...bloc(q) })) }))
    .sort((a, b) => (a.quarts[0]?.de ?? Infinity) - (b.quarts[0]?.de ?? Infinity) || a.emp.nom.localeCompare(b.emp.nom, "fr"));
  const presents = rangees.filter((r) => r.quarts.length > 0).length;

  function clicRangee(e, employeId) {
    const boite = e.currentTarget.getBoundingClientRect();
    const minute = debut * 60 + ((e.clientX - boite.left) / boite.width) * total;
    const depart = Math.max(0, Math.min(23 * 60, Math.floor(minute / 30) * 30));
    onAjouter(employeId, heureTexte(depart), heureTexte(Math.min(depart + 4 * 60, 23 * 60 + 59)));
  }

  const titre = new Date(`${date}T12:00:00`).toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="hjour">
      <div className="hjour-barre">
        <button className="admin-icon-btn" onClick={onRetour}>
          <IconFlecheGauche className="gozly-icon" />{" "}{t("Semaine")}
        </button>
        <button className="admin-icon-btn" onClick={() => onJour(-1)} aria-label={t("Jour précédent")}>
          <IconFlecheGauche className="gozly-icon" />
        </button>
        <span className="hjour-titre">{titre}</span>
        <button className="admin-icon-btn" onClick={() => onJour(1)} aria-label={t("Jour suivant")}>
          <IconFlecheDroite className="gozly-icon" />
        </button>
        <span className="hjour-compte">{t("{n} à l'horaire", { n: presents })}</span>
      </div>

      <div className="hjour-cadre">
        <div className="hjour-table" style={{ "--hjour-heures": heures.length }}>
          <div className="hjour-ligne hjour-entete">
            <div className="hjour-nom" />
            <div className="hjour-piste">
              {heures.map((h) => (
                <span key={h} className="hjour-heure">{heureTexte(h * 60)}</span>
              ))}
            </div>
          </div>
          {rangees.map(({ emp, quarts: blocs }) => (
            <div className="hjour-ligne" key={emp.id}>
              <div className={`hjour-nom${blocs.length ? "" : " libre"}`} title={emp.nom}>{emp.nom}</div>
              <div className="hjour-piste hjour-cliquable" onClick={(e) => clicRangee(e, emp.id)}>
                {blocs.map(({ q, de, a }) => (
                  <button
                    key={q.id}
                    type="button"
                    className={`hjour-bloc${q.publie ? "" : " brouillon"}`}
                    style={{ left: pourcent(de - debut * 60), width: pourcent(a - de) }}
                    title={`${emp.nom} · ${q.heure_debut.slice(0, 5)} - ${q.heure_fin.slice(0, 5)}${q.poste ? ` · ${q.poste}` : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onModifier(q);
                    }}
                  >
                    <strong>{q.heure_debut.slice(0, 5)} - {q.heure_fin.slice(0, 5)}</strong>
                    {q.poste && <span>{q.poste}</span>}
                    {!q.publie && <span className="horaire-chip-badge">{t("Brouillon")}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
