"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { setEntrepriseSelectionnee } from "@/lib/entreprise";
import { limiteEntreprises } from "@/lib/modules";

// Un même compte peut posséder plusieurs entreprises distinctes (ex: deux
// succursales immatriculées séparément, avec leur propre paie et leurs
// propres registres) - chacune a ses propres modules et ses propres données,
// mais elles partagent TOUTES le même forfait/abonnement, celui du compte
// (une seule facture - voir supabase/forfait_par_compte.sql). Le nombre
// d'entreprises qu'un compte peut posséder dépend donc de ce forfait
// (lib/modules.js, LIMITES_ENTREPRISES). Un propriétaire qui veut une
// facture séparée pour une autre entreprise doit utiliser un compte différent.
export default function CreerEntrepriseModal({ onClose }) {
  const [nom, setNom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [chargement, setChargement] = useState(true);
  const [nbActuel, setNbActuel] = useState(0);
  const [limite, setLimite] = useState(1);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setChargement(false);
      return;
    }

    const [{ data: profil }, { count }] = await Promise.all([
      supabase.from("profils").select("forfait").eq("id", user.id).maybeSingle(),
      supabase.from("membres").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("role", "proprietaire"),
    ]);

    setLimite(limiteEntreprises(profil?.forfait));
    setNbActuel(count || 0);
    setChargement(false);
  }

  const limiteAtteinte = nbActuel >= limite;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim() || saving || limiteAtteinte) return;

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

    // Id généré côté client : évite de devoir relire la ligne juste après
    // l'avoir insérée (la politique de sécurité qui autorise la lecture
    // exige d'être déjà membre, ce qui n'est vrai qu'après l'étape suivante -
    // relire immédiatement échouerait à cause de RLS même si la création a
    // réussi).
    const entrepriseId = crypto.randomUUID();

    const { error: entrepriseError } = await supabase
      .from("entreprises")
      .insert({ id: entrepriseId, nom: nom.trim() });

    if (entrepriseError) {
      setSaving(false);
      setError("La création de l'entreprise a échoué. Réessaie dans un instant.");
      return;
    }

    // Un déclencheur donne automatiquement à cette entreprise le forfait déjà
    // payé par ce compte (voir supabase/forfait_par_compte.sql).
    const { error: membreError } = await supabase
      .from("membres")
      .insert({ entreprise_id: entrepriseId, user_id: user.id, role: "proprietaire" });

    setSaving(false);

    if (membreError) {
      setError("L'entreprise a été créée, mais le lien avec ton compte a échoué. Contacte-nous.");
      return;
    }

    setEntrepriseSelectionnee(entrepriseId);
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
          Une entreprise séparée, avec ses propres modules et ses propres données - utile si tu gères deux
          entreprises immatriculées différemment (par exemple deux succursales avec leur propre paie). Elle partage
          le forfait de ton compte, une seule facture pour toutes tes entreprises.
        </p>

        {!chargement && limiteAtteinte ? (
          <p className="settings-msg err">
            Ton forfait actuel permet {limite === Infinity ? "un nombre illimité" : limite} entreprise
            {limite > 1 ? "s" : ""} ({nbActuel}/{limite === Infinity ? "∞" : limite} déjà créées). Change de forfait
            dans Paramètres &gt; Abonnement pour en ajouter d'autres.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="nom-entreprise">Nom de l'entreprise</label>
              <input
                id="nom-entreprise"
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex: Mon restaurant - Centre-ville"
                required
                autoFocus
              />
            </div>

            {error && <p className="settings-msg err">{error}</p>}

            <div className="submit-wrap" style={{ marginTop: "16px", position: "static" }}>
              <button type="submit" className="submit-btn" disabled={saving || !nom.trim() || chargement}>
                {saving ? "Création..." : "Créer l'entreprise"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
