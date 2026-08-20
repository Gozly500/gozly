"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const FORFAITS = [
  { id: "opale", label: "Opale", detail: "3 modules - 25$/mois" },
  { id: "onyx", label: "Onyx", detail: "5 modules - 40$/mois" },
  { id: "crystal", label: "Crystal", detail: "Modules illimités - 50$/mois" },
];

export default function AbonnementSection({ entreprise }) {
  const [forfaitOpen, setForfaitOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkoutMsg, setCheckoutMsg] = useState(null);

  const current = FORFAITS.find((f) => f.id === entreprise?.forfait);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setCheckoutMsg({ type: "ok", text: "Paiement confirmé ! Ton forfait sera mis à jour dans quelques instants." });
    } else if (params.get("checkout") === "cancel") {
      setCheckoutMsg({ type: "err", text: "Le paiement a été annulé." });
    }
    if (params.has("checkout")) {
      window.history.replaceState({}, "", "/parametres");
    }
  }, []);

  async function startCheckout(forfaitId) {
    setForfaitOpen(false);
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ forfait: forfaitId }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error || "Le paiement n'est pas encore disponible.");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      setError("Le paiement n'est pas encore disponible.");
      setLoading(false);
    }
  }

  async function handleManageBilling() {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error || "La gestion de l'abonnement n'est pas encore disponible.");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (e) {
      setError("La gestion de l'abonnement n'est pas encore disponible.");
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Abonnement</h2>
      <p className="panel-hint">Ton forfait, ton moyen de paiement et tes factures.</p>

      {checkoutMsg && <p className={`settings-msg ${checkoutMsg.type}`}>{checkoutMsg.text}</p>}

      <div className="settings-section">
        <h3>Forfait actuel</h3>
        <p className="section-hint">Le forfait détermine les modules disponibles dans ton tableau de bord.</p>

        {current ? (
          <span className="forfait-badge">
            {current.label} - {current.detail}
          </span>
        ) : (
          <span className="forfait-badge none">Aucun forfait actif</span>
        )}

        <div style={{ marginTop: "18px" }}>
          <label>{current ? "Changer de forfait" : "Choisir un forfait"}</label>
          <div className="forfait-select-wrap" style={{ maxWidth: "360px" }}>
            <div
              className={`forfait-select-trigger${forfaitOpen ? " open" : ""}`}
              onClick={() => setForfaitOpen((v) => !v)}
            >
              <div>
                <div className="fs-label">{current ? current.label : "Sélectionner..."}</div>
                <div className="fs-detail">{current ? current.detail : "Choisis un forfait pour continuer"}</div>
              </div>
              <span className="fs-arrow">▾</span>
            </div>
            {forfaitOpen && (
              <div className="forfait-select-options open">
                {FORFAITS.map((f) => (
                  <div key={f.id} className="forfait-option" onClick={() => startCheckout(f.id)}>
                    <div className="fo-label">{f.label}</div>
                    <div className="fo-detail">{f.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="settings-divider">Paiement et facturation</div>

      <div className="settings-section">
        <p className="section-hint">
          Le moyen de paiement, l'historique de facturation et l'annulation se gèrent depuis le portail Stripe.
        </p>
        <button type="button" className="submit-btn" onClick={handleManageBilling} disabled={loading}>
          {loading ? "Ouverture..." : "Gérer mon abonnement"}
        </button>
        {error && <p className="settings-msg err">{error}</p>}
      </div>
    </div>
  );
}
