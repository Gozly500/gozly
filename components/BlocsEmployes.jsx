"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";

// Choix d'employés en extra (blocs de 5) avant le paiement. N'apparaît que si le prix « employe_extra » existe dans Stripe
// pour la période choisie : sans lui, il ne se passe rien.
export default function BlocsEmployes({ valeur, onChange, periode, disabled, compact }) {
  const { t } = useT();
  const [prix, setPrix] = useState(null);

  useEffect(() => {
    fetch("/api/stripe/employes-extra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prix" }),
    })
      .then((r) => r.json())
      .then((d) => setPrix(d.prix || null))
      .catch(() => {});
  }, []);

  const p = prix?.[periode === "annuel" ? "annuel" : "mensuel"];
  useEffect(() => {
    if (prix && !p && valeur > 0) onChange(0);
  }, [prix, p, valeur]);
  if (!p || p.montant == null) return null;

  const unite = periode === "annuel" ? t("/an") : t("/mois");
  return (
    <div className={`blocs-employes${compact ? " compact" : ""}`}>
      <div className="blocs-employes-texte">
        <strong>{t("Plus de 5 employés?")}</strong>
        <span>
          {t("Ajoute des blocs de 5 employés")} : {p.montant.toLocaleString("fr-CA")} $ {unite} {t("par bloc")}
        </span>
      </div>
      <div className="blocs-employes-choix">
        <button type="button" className="admin-icon-btn" disabled={disabled || valeur <= 0} onClick={() => onChange(valeur - 1)} aria-label={t("Retirer un bloc")}>
          −
        </button>
        <span className="blocs-employes-valeur">{valeur * 5 > 0 ? `+ ${valeur * 5}` : "0"}</span>
        <button type="button" className="admin-icon-btn" disabled={disabled || valeur >= 20} onClick={() => onChange(valeur + 1)} aria-label={t("Ajouter un bloc")}>
          +
        </button>
      </div>
    </div>
  );
}
