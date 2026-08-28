"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EmplacementSelect from "@/components/EmplacementSelect";
import { permissionsParModule, MODULES_PERMISSIONS } from "@/lib/permissions";

export default function EquipeSection({ entrepriseId, userId, onLeft }) {
  const [loading, setLoading] = useState(true);
  const [membres, setMembres] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [ouverts, setOuverts] = useState(() => new Set());
  const [drafts, setDrafts] = useState({}); // { [membreId]: [{ permission, emplacement_id }] } - brouillon local, pas encore enregistré
  const [shaking, setShaking] = useState(null); // membreId dont le bouton Enregistrer doit trembler
  const [savingPermissions, setSavingPermissions] = useState(null); // membreId en cours d'enregistrement

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const [membresResRaw, invitationsRes, emplacementsRes] = await Promise.all([
      fetch(`/api/team/members?entrepriseId=${entrepriseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      supabase
        .from("invitations")
        .select("*")
        .eq("entreprise_id", entrepriseId)
        .eq("statut", "en_attente")
        .order("created_at", { ascending: false }),
      supabase.from("emplacements").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
    ]);

    const membresRes = await membresResRaw.json();

    if (!membresResRaw.ok) {
      setError(membresRes.error || "Impossible de charger l'équipe.");
      setMembres([]);
    } else {
      setMembres(membresRes.membres || []);
    }

    setInvitations(invitationsRes.data || []);
    setEmplacements(emplacementsRes.data || []);
    setLoading(false);
  }

  function origineDraft(membre) {
    return (membre.permissions || []).map((p) => ({ permission: p.permission, emplacement_id: p.emplacement_id }));
  }

  function estModifie(membre) {
    const draft = drafts[membre.id];
    if (!draft) return false;
    const norm = (arr) => arr.map((p) => `${p.permission}:${p.emplacement_id ?? "toutes"}`).sort().join("|");
    return norm(draft) !== norm(origineDraft(membre));
  }

  function handleToggleOuvert(membre) {
    const estOuvert = ouverts.has(membre.id);

    if (estOuvert && estModifie(membre)) {
      setShaking(membre.id);
      setTimeout(() => setShaking(null), 600);
      return;
    }

    setOuverts((prev) => {
      const next = new Set(prev);
      if (estOuvert) next.delete(membre.id);
      else next.add(membre.id);
      return next;
    });

    if (!estOuvert) {
      setDrafts((prev) => ({ ...prev, [membre.id]: origineDraft(membre) }));
    }
  }

  function handleAnnulerPermissions(membre) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[membre.id];
      return next;
    });
    setOuverts((prev) => {
      const next = new Set(prev);
      next.delete(membre.id);
      return next;
    });
  }

  function handleToggleDraftPermission(membre, permissionId, checked) {
    setDrafts((prev) => {
      const current = prev[membre.id] || [];
      const next = checked
        ? [...current, { permission: permissionId, emplacement_id: null }]
        : current.filter((p) => p.permission !== permissionId);
      return { ...prev, [membre.id]: next };
    });
  }

  function handleChangeDraftScope(membre, permissionId, emplacementId) {
    setDrafts((prev) => {
      const current = prev[membre.id] || [];
      const next = current.map((p) => (p.permission === permissionId ? { ...p, emplacement_id: emplacementId } : p));
      return { ...prev, [membre.id]: next };
    });
  }

  async function handleSavePermissions(membre) {
    setSavingPermissions(membre.id);
    const draft = drafts[membre.id] || [];

    await supabase.from("membre_permissions").delete().eq("membre_id", membre.id);
    if (draft.length > 0) {
      await supabase
        .from("membre_permissions")
        .insert(draft.map((p) => ({ membre_id: membre.id, permission: p.permission, emplacement_id: p.emplacement_id })));
    }

    await load();
    setSavingPermissions(null);
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
          <div key={m.id}>
            <div className="admin-row">
              <div className="admin-row-main">
                <div className="admin-row-title">{m.email}</div>
                <div className="admin-row-sub">{m.role === "proprietaire" ? "Propriétaire" : "Membre"}</div>
              </div>
              <div className="admin-row-controls">
                {jeSuisProprietaire && m.role !== "proprietaire" && (
                  <button className="admin-icon-btn" onClick={() => handleToggleOuvert(m)}>
                    Permissions {ouverts.has(m.id) ? "▴" : "▾"}
                  </button>
                )}
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

            {jeSuisProprietaire && m.role !== "proprietaire" && ouverts.has(m.id) && (
              <div className="settings-section" style={{ marginTop: "-8px", marginBottom: "14px" }}>
                {Object.entries(permissionsParModule()).map(([module, perms]) => (
                  <div key={module} style={{ marginBottom: "10px" }}>
                    <h4 style={{ fontSize: "12.5px", color: "var(--text-dim)", marginBottom: "8px" }}>
                      {MODULES_PERMISSIONS[module] || module}
                    </h4>
                    {perms.map((p) => {
                      const draft = drafts[m.id] || [];
                      const draftRow = draft.find((dp) => dp.permission === p.id);
                      const checked = !!draftRow;
                      const emplacementId = draftRow?.emplacement_id ?? null;
                      return (
                        <div key={p.id} style={{ marginBottom: "10px" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => handleToggleDraftPermission(m, p.id, e.target.checked)}
                            />
                            <span>
                              <strong style={{ fontSize: "13.5px" }}>{p.label}</strong>
                              <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>{p.description}</div>
                            </span>
                          </label>
                          {checked && emplacements.length > 1 && (
                            <div style={{ marginTop: "6px", marginLeft: "26px", maxWidth: "260px" }}>
                              <EmplacementSelect
                                emplacements={emplacements}
                                value={emplacementId}
                                onChange={(id) => handleChangeDraftScope(m, p.id, id)}
                                includeToutes
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {estModifie(m) && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
                    <button
                      type="button"
                      className={`submit-btn${shaking === m.id ? " shake-flash" : ""}`}
                      onClick={() => handleSavePermissions(m)}
                      disabled={savingPermissions === m.id}
                    >
                      {savingPermissions === m.id ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    <button
                      type="button"
                      className="admin-icon-btn"
                      onClick={() => handleAnnulerPermissions(m)}
                      disabled={savingPermissions === m.id}
                    >
                      Annuler
                    </button>
                    <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>Modifications non enregistrées</span>
                  </div>
                )}
              </div>
            )}
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
