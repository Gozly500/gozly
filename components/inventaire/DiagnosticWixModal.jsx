"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// Diagnostic Wix (outil de support) : montre ce que Wix répond réellement pour les produits, pour comprendre ceux qui manquent.
// Il n'est plus dans Inventaire : on l'ouvre depuis Paramètres > Intégrations > Wix > Outils de support.
export default function DiagnosticWixModal({ entrepriseId, onClose }) {
  const { t } = useT();
  const [terme, setTerme] = useState("");
  const [resultat, setResultat] = useState(null);
  const [occupe, setOccupe] = useState(false);

  async function lancer() {
    setOccupe(true);
    setResultat(null);
    try {
      const res = await fetch("/api/inventaire/diagnostic-wix", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ entrepriseId, terme }),
      });
      const data = await res.json();
      setResultat(res.ok ? data.diagnostic : { erreur: data.error, detail: data.detail });
    } catch {
      setResultat({ erreur: t("Le diagnostic a échoué.") });
    }
    setOccupe(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: "620px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("Diagnostic Wix")}</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            {t("Fermer")}
          </button>
        </div>
        <p className="section-hint">
          {t("Montre ce que Wix répond pour tes produits. Tape le début du nom d'un produit qui manque (ex: Lasagne) pour voir si Wix le renvoie.")}
        </p>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input
            type="text"
            value={terme}
            onChange={(e) => setTerme(e.target.value)}
            placeholder={t("Début du nom (optionnel)")}
            style={{ flex: 1, minWidth: 0, margin: 0 }}
          />
          <button className="submit-btn" onClick={lancer} disabled={occupe}>
            {occupe ? "..." : t("Lancer")}
          </button>
        </div>
        {resultat && <pre className="diag-resultat">{JSON.stringify(resultat, null, 2)}</pre>}
      </div>
    </div>
  );
}
