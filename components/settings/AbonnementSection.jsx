"use client";

import { useEffect, useRef, useState } from "react";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";
import { supabase } from "@/lib/supabaseClient";

const FORFAITS = [
  { id: "opale", label: "Opale", detail: "3 modules, 1 entreprise - 25$/mois" },
  { id: "onyx", label: "Onyx", detail: "5 modules, 3 entreprises - 40$/mois" },
  { id: "crystal", label: "Crystal", detail: "Modules illimités, 5 entreprises - 50$/mois" },
];

// Le forfait appartient au COMPTE (une seule facture, voir
// supabase/forfait_par_compte.sql) : il s'applique à toutes les entreprises
// que ce compte possède, pas à une seule en particulier.
export default function AbonnementSection({ profil }) {
  const [forfaitOpen, setForfaitOpen] = useState(false);
  const forfaitRef = useRef(null);
  useFermerAuClicExterieur(forfaitRef, forfaitOpen, () => setForfaitOpen(false));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkoutMsg, setCheckoutMsg] = useState(null);

  // "pilote" = forfait interne gratuit (assigné par un admin), absent de la liste
  // publique FORFAITS : sans ça il s'afficherait "Aucun forfait actif".
  const FORFAIT_PILOTE = { id: "pilote", label: "Pilote", detail: "Modules et entreprises illimités - gratuit" };
  const current = profil?.forfait === "pilote" ? FORFAIT_PILOTE : FORFAITS.find((f) => f.id === profil?.forfait);
  const achatAutoLance = useRef(false);

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

  // Arrivée depuis l'inscription avec un forfait choisi (/parametres?acheter=opale) :
  // on démarre le paiement tout de suite, sans redemander le choix.
  useEffect(() => {
    if (!profil?.id || achatAutoLance.current) return;
    const params = new URLSearchParams(window.location.search);
    const voulu = params.get("acheter");
    if (!voulu) return;
    achatAutoLance.current = true;
    window.history.replaceState({}, "", "/parametres");
    if (!profil.forfait && FORFAITS.some((f) => f.id === voulu)) {
      startCheckout(voulu);
    }
  }, [profil?.id]);

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
      <p className="panel-hint">
        Ton forfait, ton moyen de paiement et tes factures - une seule facture pour toutes les entreprises de ton
        compte.
      </p>

      {checkoutMsg && <p className={`settings-msg ${checkoutMsg.type}`}>{checkoutMsg.text}</p>}

      <div className="settings-section">
        <h3>Forfait actuel</h3>
        <p className="section-hint">
          Le forfait détermine les modules disponibles et le nombre d'entreprises que tu peux créer.
        </p>

        {current ? (
          <span className="forfait-badge">
            {current.label} - {current.detail}
          </span>
        ) : (
          <span className="forfait-badge none">Aucun forfait actif</span>
        )}

        <div style={{ marginTop: "18px" }}>
          <label>{current ? "Changer de forfait" : "Choisir un forfait"}</label>
          <div className="forfait-select-wrap" style={{ maxWidth: "360px" }} ref={forfaitRef}>
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
