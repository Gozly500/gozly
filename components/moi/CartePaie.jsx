"use client";

import Link from "next/link";
import { useLangue } from "@/components/moi/LangueContext";
import { formatMontant } from "@/lib/commandes";

const POINTS = "•••••"; // toujours la même longueur : le nombre de points ne trahit pas le montant

export const montantDe = (minutes, taux) => Math.round(((minutes || 0) / 60) * taux * 100) / 100;

export function formatHeures(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

const Oeil = ({ barre }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 22, height: 22 }}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {barre && <path d="M4 4l16 16" />}
  </svg>
);

// Montant, ou des points tant que les montants sont cachés.
export function Montant({ valeur, cache }) {
  return <span className="moi-paie-montant">{cache ? POINTS : formatMontant(valeur)}</span>;
}

// Carte « Ma paie cette semaine » de l'horaire : gagné jusqu'ici et prévu, avec un bouton œil pour cacher les montants.
export default function CartePaie({ paie, cache, onBascule }) {
  const { t } = useLangue();
  if (!paie?.actif) return null;

  if (paie.taux == null) {
    return (
      <div className="moi-paie">
        <div className="moi-paie-tete">
          <strong>{t("paie.semaine")}</strong>
        </div>
        <p className="moi-paie-note">{t("paie.entrerTaux")}</p>
        <Link href="/moi/parametres/paie" className="admin-icon-btn" style={{ display: "inline-block", textDecoration: "none" }}>
          {t("paie.versParametres")}
        </Link>
      </div>
    );
  }

  const gagne = montantDe(paie.minutesGagnees, paie.taux);
  const prevu = montantDe(paie.minutesPrevues, paie.taux);
  const pct = paie.minutesPrevues > 0 ? Math.min(100, Math.round((paie.minutesGagnees / paie.minutesPrevues) * 100)) : 0;

  return (
    <div className="moi-paie">
      <div className="moi-paie-tete">
        <strong>{t("paie.semaine")}</strong>
        <button type="button" className="moi-paie-oeil" onClick={onBascule} aria-pressed={!cache} aria-label={t(cache ? "paie.afficher" : "paie.cacher")} title={t(cache ? "paie.afficher" : "paie.cacher")}>
          <Oeil barre={!cache} />
        </button>
      </div>

      <div className="moi-paie-ligne">
        <span>{t("paie.gagne")}</span>
        <span className="moi-paie-valeurs">
          <Montant valeur={gagne} cache={cache} />
          <small>{formatHeures(paie.minutesGagnees)}</small>
        </span>
      </div>
      <div className="moi-paie-barre" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="moi-paie-ligne secondaire">
        <span>{t("paie.prevu")}</span>
        <span className="moi-paie-valeurs">
          <Montant valeur={prevu} cache={cache} />
          <small>{formatHeures(paie.minutesPrevues)}</small>
        </span>
      </div>

      <p className="moi-paie-note">
        {t("paie.brut")} {t(paie.source === "pointage" ? "paie.srcPointage" : "paie.srcHoraire")}.
      </p>
    </div>
  );
}
