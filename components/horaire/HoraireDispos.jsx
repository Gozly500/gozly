"use client";

import { useState } from "react";
import { IconFlecheDroite, IconFlecheGauche } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";
import { dispoDe, heuresDispo, genreDispo, texteDispo, dateDe, plusJours } from "@/lib/disponibilites";

const NB = 28;

// Vue d'ensemble : qui est disponible, jour par jour, sur 4 semaines. Un clic sur une date ouvre sa semaine dans l'horaire.
export default function HoraireDispos({ depart, employes, periodes, onJour, nonActif = false }) {
  const { t } = useT();
  const [debut, setDebut] = useState(depart);
  const jours = Array.from({ length: NB }, (_, i) => plusJours(debut, i));
  const texte = (iso, options) => dateDe(iso).toLocaleDateString(loc(), options);

  return (
    <div className="hdispo">
      <div className="planning-week-nav">
        <button className="admin-icon-btn" onClick={() => setDebut(plusJours(debut, -NB))} aria-label={t("Précédent")}>
          <IconFlecheGauche className="gozly-icon" />
        </button>
        <span className="planning-week-label">
          {texte(debut, { day: "numeric", month: "long" })} - {texte(jours[NB - 1], { day: "numeric", month: "long", year: "numeric" })}
        </span>
        <button className="admin-icon-btn" onClick={() => setDebut(plusJours(debut, NB))} aria-label={t("Suivant")}>
          <IconFlecheDroite className="gozly-icon" />
        </button>
      </div>

      <div className="hdispo-cadre">
        <div className="hdispo-table" style={{ "--hdispo-jours": NB }}>
          <div className="hdispo-nom" />
          {jours.map((iso) => (
            <button type="button" key={iso} className={`hdispo-date${[0, 6].includes(dateDe(iso).getDay()) ? " fds" : ""}`} onClick={() => onJour(iso)}>
              <span>{texte(iso, { weekday: "narrow" })}</span>
              <strong>{Number(iso.slice(8))}</strong>
              <small>{texte(iso, { month: "short" })}</small>
            </button>
          ))}

          {employes.map((emp) => (
            <div className="hdispo-rangee" key={emp.id}>
              <div className="hdispo-nom" title={emp.nom}>{emp.nom}</div>
              {jours.map((iso) => {
                const p = dispoDe(periodes, emp.id, iso);
                if (!p) return <div className="hdispo-case" key={iso} />;
                const avant = dispoDe(periodes, emp.id, plusJours(iso, -1))?.id === p.id;
                const apres = dispoDe(periodes, emp.id, plusJours(iso, 1))?.id === p.id;
                const info = [emp.nom, p.non ? texteDispo(p, t) : heuresDispo(p) || t("Toute la journée"), p.note].filter(Boolean).join(" · ");
                return (
                  <div className="hdispo-case" key={iso} title={info}>
                    <span className={`hdispo-barre${genreDispo(p)}${avant ? " suite-avant" : ""}${apres ? " suite-apres" : ""}`} />
                  </div>
                );
              })}
            </div>
          ))}

          <div className="hdispo-nom hdispo-total">{t("Disponibles")}</div>
          {jours.map((iso) => {
            const n = employes.filter((e) => { const p = dispoDe(periodes, e.id, iso); return p && !p.non; }).length;
            return (
              <div className={`hdispo-case hdispo-total${n ? "" : " zero"}`} key={iso}>{n}</div>
            );
          })}
        </div>
      </div>

      <div className="hdispo-legende">
        <span><i className="hdispo-barre" /> {t("Toute la journée")}</span>
        <span><i className="hdispo-barre partiel" /> {t("Certaines heures")}</span>
        {nonActif && <span><i className="hdispo-barre non" /> {t("Pas disponible")}</span>}
      </div>
    </div>
  );
}
