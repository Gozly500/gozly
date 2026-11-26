"use client";

import { useState } from "react";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";
import { bloc } from "@/lib/horaireJour";

const heuresDe = (liste) => liste.reduce((s, q) => s + bloc(q).a - bloc(q).de, 0) / 60;

// Modèle « Tableau » : les employés en rangées, les jours en colonnes. Un clic sur une case ajoute un quart,
// un clic sur un bloc le modifie, un clic sur une date ouvre la journée.
export default function HoraireTableau({ jours, employes, quarts, recherche, onRecherche, onAjouter, onModifier, onDeplacer, onJour }) {
  const { t } = useT();
  const [survol, setSurvol] = useState(null); // case survolée pendant un glisser-déposer
  const total = (liste) => `${heuresDe(liste).toLocaleString(loc(), { maximumFractionDigits: 1 })} h`;

  return (
    <div className="htab-cadre">
      <div className="htab">
        <div className="htab-coin">
          <input type="text" value={recherche} onChange={(e) => onRecherche(e.target.value)} placeholder={t("Rechercher...")} />
        </div>
        {jours.map((j) => (
          <button type="button" key={j.iso} className="htab-jour" onClick={() => onJour(j.iso)}>
            <strong>{j.nom}</strong>
            <span>{j.date}</span>
            <span>{total(quarts.filter((q) => q.date === j.iso))}</span>
          </button>
        ))}
        {employes.map((emp) => {
          const siens = quarts.filter((q) => q.employe_id === emp.id);
          return (
            <div className="htab-rangee" key={emp.id}>
              <div className="htab-nom">
                <strong title={emp.nom}>{emp.nom}</strong>
                <span>{total(siens)}</span>
              </div>
              {jours.map((j) => (
                <div
                  className={`htab-case${survol === `${emp.id}|${j.iso}` ? " survol" : ""}`}
                  key={j.iso}
                  onClick={() => onAjouter(emp.id, j.iso)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSurvol(`${emp.id}|${j.iso}`);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setSurvol(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setSurvol(null);
                    const id = e.dataTransfer.getData("application/x-quart");
                    const q = quarts.find((x) => String(x.id) === id);
                    if (q) onDeplacer(q.id, j.iso, emp.id);
                  }}
                >
                  {siens
                    .filter((q) => q.date === j.iso)
                    .map((q) => (
                      <button
                        type="button"
                        key={q.id}
                        className={`htab-bloc${q.publie ? "" : " brouillon"}`}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("application/x-quart", String(q.id))}
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
                  <span className="htab-plus" aria-hidden="true">+</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
