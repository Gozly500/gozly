"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const FORFAIT_LABELS = {
  opale: "Opale",
  onyx: "Onyx",
  crystal: "Crystal",
};

export default function AbonnementSection({ entreprise }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const forfaitLabel = entreprise?.forfait ? FORFAIT_LABELS[entreprise.forfait] || entreprise.forfait : null;

  async function handleManageBilling() {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

      <div className="settings-section">
        <h3>Forfait actuel</h3>
        <p className="section-hint">Le forfait détermine les modules disponibles dans ton tableau de bord.</p>

        {forfaitLabel ? (
          <span className="forfait-badge">{forfaitLabel}</span>
        ) : (
          <span className="forfait-badge none">Aucun forfait actif</span>
        )}

        <div style={{ marginTop: "14px" }}>
          <Link href="/s-abonner" className="btn-small" style={{ display: "inline-block", textDecoration: "none" }}>
            {forfaitLabel ? "Changer de forfait" : "Choisir un forfait"}
          </Link>
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
