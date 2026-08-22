"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function EquipeSection({ entrepriseId, userId, onLeft }) {
  const [loading, setLoading] = useState(true);
  const [membres, setMembres] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const [membresResRaw, invitationsRes] = await Promise.all([
      fetch(`/api/team/members?entrepriseId=${entrepriseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      supabase
        .from("invitations")
        .select("*")
        .eq("entreprise_id", entrepriseId)
        .eq("statut", "en_attente")
        .order("created_at", { ascending: false }),
    ]);

    const membresRes = await membresResRaw.json();

    if (!membresResRaw.ok) {
      setError(membresRes.error || "Impossible de charger l'équipe.");
      setMembres([]);
    } else {
      setMembres(membresRes.membres || []);
    }

    setInvitations(invitationsRes.data || []);
    setLoading(false);
  }

  async function handleInvite(e) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;
    setInviting(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();

    const { error } = await supabase.from("invitations").insert({
      entreprise_id: entrepriseId,
      email: value,
      invited_by: sessionData?.session?.user?.id,
    });

    setInviting(false);

    if (error) {
      setError("L'invitation a échoué : " + error.message);
      return;
    }

    setEmail("");
    load();
  }

  async function handleCancelInvite(id) {
    await supabase.from("invitations").delete().eq("id", id);
    load();
  }

  async function handleRemoveMembre(membre) {
    const estMoi = membre.user_id === userId;

    if (estMoi && membre.role === "proprietaire") {
      setError(
        "Un propriétaire ne peut pas quitter son propre dashboard. Passe par \"Supprimer mon compte\" dans Paramètres si tu ne veux plus t'en occuper."
      );
      return;
    }

    if (estMoi && !window.confirm("Quitter ce dashboard ? Tu perdras l'accès immédiatement.")) {
      return;
    }

    const { error } = await supabase.from("membres").delete().eq("id", membre.id);

    if (error) {
      setError("L'opération a échoué : " + error.message);
      return;
    }

    if (estMoi) {
      onLeft?.();
      return;
    }

    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  const monRole = membres.find((m) => m.user_id === userId)?.role;
  const jeSuisProprietaire = monRole === "proprietaire";

  return (
    <div>
      <h2>Équipe</h2>
      <p className="panel-hint">Les comptes qui ont accès à ce dashboard.</p>
      {error && <p className="settings-msg err">{error}</p>}

      <div className="admin-list" style={{ marginBottom: "24px", maxWidth: "560px" }}>
        {membres.map((m) => (
          <div className="admin-row" key={m.id}>
            <div className="admin-row-main">
              <div className="admin-row-title">{m.email}</div>
              <div className="admin-row-sub">{m.role === "proprietaire" ? "Propriétaire" : "Membre"}</div>
            </div>
            <div className="admin-row-controls">
              {m.user_id === userId
                ? m.role !== "proprietaire" && (
                    <button className="admin-icon-btn danger" onClick={() => handleRemoveMembre(m)}>
                      Quitter
                    </button>
                  )
                : jeSuisProprietaire && (
                    <button className="admin-icon-btn danger" onClick={() => handleRemoveMembre(m)}>
                      Retirer
                    </button>
                  )}
            </div>
          </div>
        ))}
      </div>

      {invitations.length > 0 && (
        <>
          <div className="settings-divider">Invitations en attente</div>
          <div className="admin-list" style={{ marginBottom: "24px", maxWidth: "560px" }}>
            {invitations.map((inv) => (
              <div className="admin-row" key={inv.id}>
                <div className="admin-row-main">
                  <div className="admin-row-title">{inv.email}</div>
                  <div className="admin-row-sub">En attente de réponse</div>
                </div>
                <div className="admin-row-controls">
                  <button className="admin-icon-btn" onClick={() => handleCancelInvite(inv.id)}>
                    Annuler
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="settings-divider">Inviter quelqu'un</div>
      <form className="admin-add-form" onSubmit={handleInvite}>
        <input
          type="email"
          placeholder="courriel@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="btn-small" disabled={inviting}>
          {inviting ? "Envoi..." : "Inviter"}
        </button>
      </form>
      <p className="section-hint" style={{ marginTop: "10px" }}>
        La personne verra l'invitation dès sa prochaine connexion (ou après avoir créé son compte Gozly si
        elle n'en a pas encore).
      </p>
    </div>
  );
}
