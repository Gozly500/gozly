"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { setEntrepriseSelectionnee } from "@/lib/entreprise";

// Un même compte peut posséder plusieurs entreprises distinctes (ex: deux
// succursales immatriculées séparément, avec leur propre paie et leurs
// propres registres) - chacune a son propre abonnement, son propre forfait
// et ses propres modules. Rien à changer côté base : "entreprises" accepte
// déjà l'insertion par n'importe quel compte authentifié (policy_inscription.sql),
// et "membres" relie ce compte à autant d'entreprises que nécessaire (equipe.sql).
export default function CreerEntrepriseModal({ onClose }) {
  const [nom, setNom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim() || saving) return;

    setSaving(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      setError("Session expirée. Reconnecte-toi et réessaie.");
      return;
    }

    const { data: entreprise, error: entrepriseError } = await supabase
      .from("entreprises")
      .insert({ nom: nom.trim() })
      .select("id")
      .single();

    if (entrepriseError || !entreprise) {
      setSaving(false);
      setError("La création de l'entreprise a échoué. Réessaie dans un instant.");
      return;
    }

    const { error: membreError } = await supabase
      .from("membres")
      .insert({ entreprise_id: entreprise.id, user_id: user.id, role: "proprietaire" });

    setSaving(false);

    if (membreError) {
      setError("L'entreprise a été créée, mais le lien avec ton compte a échoué. Contacte-nous.");
      return;
    }

    setEntrepriseSelectionnee(entreprise.id);
    // Rechargement complet (pas router.push) : si on est déjà sur /dashboard,
    // un push vers la même route ne remonterait pas la page, et l'ancienne
    // entreprise resterait affichée malgré le changement de sélection.
    window.location.href = "/dashboard";
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Créer une nouvelle entreprise</h3>
          <button className="admin-icon-btn" onClick={onClose} type="button">
            Fermer
          </button>
        </div>
        <p className="section-hint" style={{ marginBottom: "16px" }}>
          Une entreprise séparée, avec son propre forfait, ses propres modules et ses propres données - utile si tu
          gères deux entreprises immatriculées différemment (par exemple deux succursales avec leur propre paie).
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="nom-entreprise">Nom de l'entreprise</label>
            <input
              id="nom-entreprise"
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: Pasta Sainte-Marthe"
              required
              autoFocus
            />
          </div>

          {error && <p className="settings-msg err">{error}</p>}

          <div className="submit-wrap" style={{ marginTop: "16px", position: "static" }}>
            <button type="submit" className="submit-btn" disabled={saving || !nom.trim()}>
              {saving ? "Création..." : "Créer l'entreprise"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
