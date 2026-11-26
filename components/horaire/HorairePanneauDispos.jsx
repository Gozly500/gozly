"use client";

import { useT } from "@/components/LangProvider";
import { dispoDe, heuresDispo, genreDispo, texteDispo } from "@/lib/disponibilites";

// Mode « panneau à côté » : les disponibilités de la semaine affichée, sans rien ajouter dans les cases de l'horaire.
export default function HorairePanneauDispos({ jours, employes, periodes }) {
  const { t } = useT();
  const liste = employes
    .map((emp) => ({ emp, semaine: jours.map((j) => ({ ...j, p: dispoDe(periodes, emp.id, j.iso) })) }))
    .filter((l) => l.semaine.some((j) => j.p));

  return (
    <aside className="hpan">
      <strong className="hpan-titre">{t("Disponibilités")}</strong>
      {liste.length === 0 && <span className="hpan-vide">{t("Personne")}</span>}
      {liste.map(({ emp, semaine }) => {
        // Les heures précises, regroupées par plage : « 17:00 - 22:00 : lun., mar. ».
        const plages = new Map();
        semaine.filter((j) => j.p?.de).forEach((j) => {
          const h = j.p.non ? texteDispo(j.p, t) : heuresDispo(j.p);
          plages.set(h, { genre: genreDispo(j.p).trim(), noms: [...(plages.get(h)?.noms || []), j.nom.slice(0, 3).toLowerCase()] });
        });
        const notes = [...new Set(semaine.map((j) => j.p?.note).filter(Boolean))];
        return (
          <div className="hpan-employe" key={emp.id}>
            <span className="hpan-nom">{emp.nom}</span>
            <div className="hpan-jours">
              {semaine.map((j) => (
                <span
                  key={j.iso}
                  className={j.p ? genreDispo(j.p).trim() || "libre" : ""}
                  title={`${j.nom} ${j.date}${j.p ? ` · ${j.p.non ? texteDispo(j.p, t) : heuresDispo(j.p) || t("Toute la journée")}` : ""}`}
                >
                  {j.nom.slice(0, 1)}
                </span>
              ))}
            </div>
            {[...plages].map(([h, { genre, noms }]) => (
              <small className={genre} key={h}>{h} · {noms.join(", ")}</small>
            ))}
            {notes.map((n) => (
              <small key={n}>{n}</small>
            ))}
          </div>
        );
      })}
    </aside>
  );
}
