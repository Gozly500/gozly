"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";

async function appeler(corps) {
  const { data: sessionData } = await supabase.auth.getSession();
  const res = await fetch("/api/stripe/employes-extra", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData?.session?.access_token}` },
    body: JSON.stringify(corps),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Paramètres > Abonnement : ajouter ou retirer des blocs de 5 employés par entreprise. Les changements sont facturés au prorata sur la
// même facture que le forfait. N'apparaît pas si le forfait n'a pas de limite d'employés ou si le prix Stripe n'existe pas encore.
export default function EmployesExtraAbonnement() {
  const { t } = useT();
  const [etat, setEtat] = useState(null);
  const [choix, setChoix] = useState({}); // { entrepriseId: blocs }
  const [occupeId, setOccupeId] = useState(null);
  const [message, setMessage] = useState(null);

  async function charger() {
    const { ok, data } = await appeler({ action: "etat" });
    if (!ok || !data.disponible) {
      setEtat(null);
      return;
    }
    setEtat(data);
    setChoix(Object.fromEntries(data.entreprises.map((e) => [e.id, e.extra])));
  }
  useEffect(() => {
    charger();
  }, []);

  async function appliquer(e) {
    setOccupeId(e.id);
    setMessage(null);
    const { ok, data } = await appeler({ action: "modifier", entrepriseId: e.id, blocs: choix[e.id] });
    setOccupeId(null);
    if (!ok) {
      setMessage({ type: "err", text: data.error || t("Impossible de modifier pour le moment.") });
      return;
    }
    setMessage({ type: "ok", text: t("C'est fait. Le changement est facturé au prorata sur ta prochaine facture.") });
    charger();
  }

  if (!etat) return null;
  const unite = etat.periode === "annuel" ? t("/an") : t("/mois");

  return (
    <>
      <div className="settings-divider">{t("Employés supplémentaires")}</div>
      <div className="settings-section">
        <p className="section-hint">
          {t("Ton forfait inclut {n} employés par entreprise. Ajoute des blocs de 5 employés au besoin : {prix} $ {unite} par bloc.", {
            n: etat.base,
            prix: etat.prix.montant.toLocaleString("fr-CA"),
            unite,
          })}
        </p>
        {etat.entreprises.map((e) => {
          const voulu = choix[e.id] ?? e.extra;
          const limite = etat.base + e.extra * etat.bloc;
          const changement = voulu !== e.extra;
          const diff = (voulu - e.extra) * etat.prix.montant;
          return (
            <div className="admin-row" key={e.id} style={{ flexWrap: "wrap" }}>
              <div className="admin-row-main">
                <div className="admin-row-title">{e.nom}</div>
                <div className="admin-row-sub">
                  {t("{n} employés sur {limite}", { n: e.employes, limite })}
                  {e.extra > 0 ? ` (${etat.base} + ${e.extra * etat.bloc})` : ""}
                </div>
              </div>
              <div className="blocs-employes-choix">
                <button type="button" className="admin-icon-btn" disabled={occupeId === e.id || voulu <= 0} onClick={() => setChoix((c) => ({ ...c, [e.id]: voulu - 1 }))}>
                  −
                </button>
                <span className="blocs-employes-valeur">{voulu * etat.bloc > 0 ? `+ ${voulu * etat.bloc}` : "0"}</span>
                <button type="button" className="admin-icon-btn" disabled={occupeId === e.id || voulu >= 20} onClick={() => setChoix((c) => ({ ...c, [e.id]: voulu + 1 }))}>
                  +
                </button>
                {changement && (
                  <button type="button" className="submit-btn" style={{ padding: "8px 16px" }} disabled={occupeId === e.id} onClick={() => appliquer(e)}>
                    {occupeId === e.id
                      ? "..."
                      : `${t("Confirmer")} (${diff > 0 ? "+" : "−"}${Math.abs(diff).toLocaleString("fr-CA")} $ ${unite})`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}
      </div>
    </>
  );
}
