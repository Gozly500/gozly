"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { demarrerImpersonation } from "@/lib/entreprise";
import SimpleSelect from "@/components/SimpleSelect";
import FactureCompte from "@/components/admin/FactureCompte";
import InfoTooltip from "@/components/InfoTooltip";
import { geocoderAdresse } from "@/lib/geocode";
import { limiteEntreprises } from "@/lib/modules";
import { useForfaits, rechargerForfaits } from "@/lib/useForfaits";
import { IconAttention, IconFlecheDroite, IconFlecheGauche } from "@/components/icons/Pictogrammes";

const FORFAITS = [
  { id: "", label: "Aucun forfait" },
  { id: "opale", label: "Opale" },
  { id: "onyx", label: "Onyx" },
  { id: "crystal", label: "Crystal" },
  { id: "pilote", label: "Pilote (interne, gratuit)" },
];

// Options du menu des forfaits : la table `forfaits` (sans les personnalisés des AUTRES clients), sinon la liste d'origine.
function optionsForfaits(forfaitsDb, forfaitDuCompte) {
  if (!forfaitsDb) return FORFAITS;
  return [
    { id: "", label: "Aucun forfait" },
    ...forfaitsDb
      .filter((f) => (!f.personnalise && f.actif) || f.id === forfaitDuCompte)
      .map((f) => ({ id: f.id, label: f.personnalise ? `${f.label} (personnalisé)` : f.id === "pilote" ? "Pilote (interne, gratuit)" : f.label })),
  ];
}

// Formulaire « Abonnement personnalisé » d'un compte : nom + limites (vide = illimité). Crée un forfait réservé à ce compte et le lui assigne.
function AbonnementPersonnalise({ profilId, onCree }) {
  const [ouvert, setOuvert] = useState(false);
  const [label, setLabel] = useState("");
  const [modules, setModules] = useState("");
  const [entreprises, setEntreprises] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState("");

  async function creer() {
    setOccupe(true);
    setMsg("");
    const { ok, data } = await authFetch("/api/admin/forfaits", {
      method: "POST",
      body: JSON.stringify({
        action: "creerPersonnalise",
        profilId,
        label,
        limite_modules: modules.trim() === "" ? null : Number(modules),
        limite_entreprises: entreprises.trim() === "" ? null : Number(entreprises),
      }),
    });
    setOccupe(false);
    if (!ok) {
      setMsg(data.error || "Échec");
      return;
    }
    setOuvert(false);
    setLabel("");
    setModules("");
    setEntreprises("");
    rechargerForfaits();
    onCree();
  }

  if (!ouvert) {
    return (
      <button type="button" className="admin-icon-btn" style={{ marginTop: "8px" }} onClick={() => setOuvert(true)}>
        + Abonnement personnalisé
      </button>
    );
  }
  return (
    <div className="abo-carte" style={{ marginTop: "10px", minWidth: "260px" }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Nom</label>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: Sur mesure - Restaurant X" />
      </div>
      <div className="abo-champs">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Modules (vide = illimité)</label>
          <input type="number" min="0" value={modules} onChange={(e) => setModules(e.target.value)} placeholder="illimité" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Entreprises (vide = illimité)</label>
          <input type="number" min="0" value={entreprises} onChange={(e) => setEntreprises(e.target.value)} placeholder="illimité" />
        </div>
      </div>
      {msg && <p className="settings-msg err">{msg}</p>}
      <div className="abo-actions">
        <button type="button" className="submit-btn" disabled={occupe || !label.trim()} onClick={creer}>
          {occupe ? "..." : "Créer et assigner"}
        </button>
        <button type="button" className="admin-icon-btn" disabled={occupe} onClick={() => setOuvert(false)}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// Double authentification du compte : état + bouton pour la désactiver (le client a perdu l'accès à son app d'authentification).
function DoubleAuthAdmin({ userId }) {
  const [actif, setActif] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let ignore = false;
    authFetch("/api/admin/mfa", { method: "POST", body: JSON.stringify({ userId, action: "statut" }) }).then(({ ok, data }) => {
      if (!ignore) setActif(ok ? !!data.actif : null);
    });
    return () => {
      ignore = true;
    };
  }, [userId]);

  async function desactiver() {
    if (!window.confirm("Désactiver la double authentification de ce compte ? Le client pourra se connecter avec son mot de passe seulement.")) return;
    setOccupe(true);
    setMsg("");
    const { ok, data } = await authFetch("/api/admin/mfa", { method: "POST", body: JSON.stringify({ userId, action: "desactiver" }) });
    setOccupe(false);
    if (ok) {
      setActif(false);
      setMsg("Désactivée.");
    } else {
      setMsg(data.error || "Échec");
    }
  }

  if (actif === null) return null;
  return (
    <div className="admin-edit-actions" style={{ alignItems: "center" }}>
      <span style={{ fontWeight: 600 }}>Double authentification : {actif ? "activée" : "désactivée"}</span>
      {actif && (
        <button className="admin-icon-btn danger" onClick={desactiver} disabled={occupe}>
          {occupe ? "..." : "Désactiver"}
        </button>
      )}
      {msg && <span className="section-hint">{msg}</span>}
    </div>
  );
}

async function authFetch(path, options = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Ligne d'une entreprise (dashboard, édition, suppression) - utilisée à la
// fois pour les entreprises d'un compte sélectionné (forfait en LECTURE
// SEULE : il appartient au compte, voir supabase/forfait_par_compte.sql) et
// pour les entreprises orphelines (sans aucun membre, donc sans compte pour
// porter un forfait - "forfaitEditable" y est alors modifiable directement).
function EntrepriseRow({ entreprise, profilId, forfaitEditable, onForfaitChange, onDeleted, onSaved, forfaits = FORFAITS }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    entrepriseNom: entreprise.nom || "",
    telephone: entreprise.telephone || "",
    courrielContact: entreprise.courriel_contact || "",
    adresse: entreprise.adresse || "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [adresseIntrouvable, setAdresseIntrouvable] = useState(false);

  async function handleSave() {
    setSaving(true);
    setAdresseIntrouvable(false);

    // Même mécanisme que pour les succursales (Emplacements) : l'adresse est
    // convertie en coordonnées GPS via Nominatim (voir lib/geocode.js), pour
    // que les entreprises et les succursales aient un traitement cohérent.
    const payload = { entrepriseId: entreprise.id, ...form };
    const adresseChangee = form.adresse.trim() !== (entreprise.adresse || "").trim();
    if (adresseChangee) {
      if (!form.adresse.trim()) {
        payload.latitude = null;
        payload.longitude = null;
      } else {
        const position = await geocoderAdresse(form.adresse);
        if (position) {
          payload.latitude = position.latitude;
          payload.longitude = position.longitude;
        } else {
          setAdresseIntrouvable(true);
        }
      }
    }

    const { ok, data } = await authFetch("/api/admin/clients", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "La mise à jour a échoué.");
      return;
    }
    setError(null);
    setEditing(false);
    onSaved();
  }

  async function handleDelete() {
    setDeleting(true);
    const { ok, data } = await authFetch("/api/admin/delete-client", {
      method: "POST",
      body: JSON.stringify({ entrepriseId: entreprise.id }),
    });
    setDeleting(false);
    if (!ok) {
      setError(data.error || "La suppression a échoué.");
      return;
    }
    onDeleted();
  }

  return (
    <div className="admin-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div className="admin-row-main">
          <div className="admin-row-title">{entreprise.nom}</div>
          {/* Utile pour distinguer d'un coup d'œil deux entreprises d'un même compte (ex: deux
              succursales immatriculées séparément) - retombe sur la date d'inscription si aucune
              adresse n'a été saisie. */}
          <div className="admin-row-sub">
            {entreprise.adresse || `inscrit le ${new Date(entreprise.created_at).toLocaleDateString("fr-CA")}`}
          </div>
        </div>

        <div className="admin-row-controls">
          {forfaitEditable ? (
            <div style={{ minWidth: "200px" }}>
              <SimpleSelect
                options={forfaits}
                value={entreprise.forfait || ""}
                onChange={(id) => onForfaitChange(entreprise.id, id)}
              />
            </div>
          ) : (
            <span className="admin-status-pill" title="Le forfait appartient au compte, pas à cette entreprise - voir l'onglet du compte.">
              {forfaits.find((f) => f.id === entreprise.forfait)?.label || "Aucun forfait"}
            </span>
          )}

          <button className="admin-icon-btn" onClick={() => setEditing((v) => !v)}>
            {editing ? "Fermer" : "Modifier"}
          </button>
          <button
            className="admin-icon-btn"
            onClick={() => {
              demarrerImpersonation(entreprise.id, entreprise.nom);
              router.push("/dashboard");
            }}
          >
            Voir le dashboard
          </button>
        </div>
      </div>

      {editing && (
        <div className="admin-edit-panel">
          {error && <p className="settings-msg err">{error}</p>}
          <div className="field-row">
            <div className="field">
              <label>Nom de l'entreprise</label>
              <input
                type="text"
                value={form.entrepriseNom}
                onChange={(e) => setForm((f) => ({ ...f, entrepriseNom: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Courriel de contact (entreprise)</label>
              <input
                type="email"
                value={form.courrielContact}
                onChange={(e) => setForm((f) => ({ ...f, courrielContact: e.target.value }))}
              />
            </div>
          </div>
          <div className="field">
            <label>Téléphone de l'entreprise</label>
            <input type="tel" value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} />
          </div>
          <div className="field">
            <label>Adresse</label>
            <input
              type="text"
              value={form.adresse}
              onChange={(e) => {
                setForm((f) => ({ ...f, adresse: e.target.value }));
                setAdresseIntrouvable(false);
              }}
            />
            {adresseIntrouvable && (
              <p className="section-hint" style={{ color: "#f2b95a", marginTop: "4px" }}>
                <IconAttention className="gozly-icon" /> Adresse introuvable - vérifie l'orthographe. Enregistrée quand même.
              </p>
            )}
          </div>

          <div className="admin-edit-actions">
            <button className="submit-btn" onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>

          <div className="settings-divider">Zone dangereuse</div>

          {!confirmingDelete ? (
            <div className="danger-zone">
              <div>
                <h4>Supprimer cette entreprise</h4>
                <p>
                  Efface définitivement cette entreprise et toutes ses données (planning, employés, etc). Le compte de
                  connexion {profilId ? "et ses autres entreprises ne sont pas touchés" : ""}.
                </p>
              </div>
              <button className="btn-danger" onClick={() => setConfirmingDelete(true)}>
                Supprimer l'entreprise
              </button>
            </div>
          ) : (
            <div className="danger-zone" style={{ flexDirection: "column", alignItems: "stretch", gap: "12px" }}>
              <div>
                <h4>Confirmer la suppression</h4>
                <p>
                  Tape le nom de l'entreprise (<strong>{entreprise.nom}</strong>) pour confirmer. Cette action est
                  irréversible.
                </p>
              </div>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={entreprise.nom}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn-danger" disabled={deleteConfirmText !== entreprise.nom || deleting} onClick={handleDelete}>
                  {deleting ? "Suppression..." : "Confirmer la suppression définitive"}
                </button>
                <button
                  className="admin-icon-btn"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setDeleteConfirmText("");
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClientsSection() {
  useForfaits();
  const [forfaitsDb, setForfaitsDb] = useState(null); // null tant que la table n'est pas lue (ou absente) : liste d'origine
  const [loading, setLoading] = useState(true);
  const [comptes, setComptes] = useState([]);
  const [entreprisesOrphelines, setEntreprisesOrphelines] = useState([]);
  const [error, setError] = useState(null);
  const [compteOuvertId, setCompteOuvertId] = useState(null); // userId sélectionné (vue "entreprises de ce compte")
  const [editingCompteId, setEditingCompteId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [resetResult, setResetResult] = useState({});
  const [confirmingDeleteCompte, setConfirmingDeleteCompte] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [rechercheClient, setRechercheClient] = useState("");
  const [factureCompteId, setFactureCompteId] = useState(null); // userId dont le panneau « Créer une facture » est ouvert

  useEffect(() => {
    load();
    supabase
      .from("forfaits")
      .select("*")
      .order("ordre")
      .then(({ data, error }) => {
        if (!error && data) setForfaitsDb(data);
      });
  }, []);

  async function rechargerListeForfaits() {
    const { data, error } = await supabase.from("forfaits").select("*").order("ordre");
    if (!error && data) setForfaitsDb(data);
  }

  async function load() {
    setLoading(true);
    setError(null);
    const { ok, data } = await authFetch("/api/admin/clients");
    if (!ok) {
      setError(data.error || "Impossible de charger la liste des clients.");
      setLoading(false);
      return;
    }
    setComptes(data.comptes || []);
    setEntreprisesOrphelines(data.entreprisesOrphelines || []);
    setLoading(false);
  }

  // Uniquement pour les entreprises ORPHELINES (sans compte) - sinon le
  // forfait se change au niveau du compte (handleForfaitChangeCompte),
  // voir supabase/forfait_par_compte.sql.
  async function handleForfaitChangeOrphelin(entrepriseId, forfait) {
    setEntreprisesOrphelines((prev) =>
      prev.map((e) => (e.id === entrepriseId ? { ...e, forfait: forfait || null } : e))
    );
    await supabase.from("entreprises").update({ forfait: forfait || null }).eq("id", entrepriseId);
  }

  // Change le forfait du COMPTE - un déclencheur recopie automatiquement
  // cette valeur sur toutes les entreprises dont ce compte est propriétaire.
  async function handleForfaitChangeCompte(profilId, forfait) {
    setComptes((prev) =>
      prev.map((c) => (c.profil?.id === profilId ? { ...c, profil: { ...c.profil, forfait: forfait || null } } : c))
    );
    await supabase.from("profils").update({ forfait: forfait || null }).eq("id", profilId);
    load();
  }

  async function handleToggleActif(profilId, desactive) {
    setComptes((prev) => prev.map((c) => (c.profil?.id === profilId ? { ...c, profil: { ...c.profil, desactive } } : c)));
    await supabase.from("profils").update({ desactive }).eq("id", profilId);
  }

  function startEditCompte(compte) {
    setEditingCompteId(compte.userId);
    setEditForm({
      fullName: compte.profil?.full_name || "",
      telephonePerso: compte.profil?.telephone_perso || "",
      email: compte.email || "",
    });
    setResetResult((prev) => ({ ...prev, [compte.userId]: null }));
    setConfirmingDeleteCompte(null);
    setDeleteConfirmText("");
  }

  async function handleSaveCompte(compte) {
    setSaving(true);
    const { ok, data } = await authFetch("/api/admin/clients", {
      method: "PATCH",
      body: JSON.stringify({ profilId: compte.profil?.id || null, ...editForm }),
    });
    setSaving(false);
    if (!ok) {
      setError(data.error || "La mise à jour a échoué.");
      return;
    }
    setError(null);
    setEditingCompteId(null);
    load();
  }

  async function handleResetPassword(compte) {
    if (!compte.profil) return;
    setResetResult((prev) => ({ ...prev, [compte.userId]: "..." }));
    const { ok, data } = await authFetch("/api/admin/reset-password", {
      method: "POST",
      body: JSON.stringify({ userId: compte.profil.id }),
    });
    setResetResult((prev) => ({ ...prev, [compte.userId]: ok ? data.password : data.error || "Échec" }));
  }

  async function handleDeleteCompte(compte) {
    setDeleting(true);
    const { ok, data } = await authFetch("/api/admin/delete-client", {
      method: "POST",
      body: JSON.stringify({ profilId: compte.profil?.id || compte.userId, deleteAccount: true }),
    });
    setDeleting(false);
    if (!ok) {
      setError(data.error || "La suppression a échoué.");
      return;
    }
    setError(null);
    setEditingCompteId(null);
    setConfirmingDeleteCompte(null);
    if (compteOuvertId === compte.userId) setCompteOuvertId(null);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  const compteOuvert = comptes.find((c) => c.userId === compteOuvertId) || null;

  const termeRecherche = rechercheClient.trim().toLowerCase();
  const comptesFiltres = termeRecherche
    ? comptes.filter(
        (c) =>
          (c.profil?.full_name || "").toLowerCase().includes(termeRecherche) ||
          (c.email || "").toLowerCase().includes(termeRecherche) ||
          c.entreprises.some(({ entreprise }) => (entreprise.nom || "").toLowerCase().includes(termeRecherche))
      )
    : comptes;

  if (compteOuvert) {
    return (
      <div>
        <button
          type="button"
          className="admin-icon-btn"
          style={{ marginBottom: "14px" }}
          onClick={() => setCompteOuvertId(null)}
        >
          <IconFlecheGauche className="gozly-icon" /> Retour aux comptes
        </button>
        <h2>{compteOuvert.profil?.full_name || compteOuvert.email || "Compte"}</h2>
        <p className="panel-hint">
          {compteOuvert.email} · {compteOuvert.entreprises.length} entreprise
          {compteOuvert.entreprises.length > 1 ? "s" : ""} · Forfait :{" "}
          {optionsForfaits(forfaitsDb, compteOuvert.profil?.forfait).find((f) => f.id === compteOuvert.profil?.forfait)?.label || "Aucun"} (change dans « Retour aux
          comptes »)
        </p>
        {error && <p className="settings-msg err">{error}</p>}

        <div className="admin-list">
          {compteOuvert.entreprises.map(({ entreprise }) => (
            <EntrepriseRow
              key={entreprise.id}
              entreprise={entreprise}
              profilId={compteOuvert.profil?.id}
              forfaitEditable={false}
              forfaits={optionsForfaits(forfaitsDb, compteOuvert.profil?.forfait)}
              onSaved={load}
              onDeleted={load}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Clients</h2>
      <p className="panel-hint">Tous les comptes inscrits sur Gozly ({comptes.length}).</p>
      {error && <p className="settings-msg err">{error}</p>}

      <div className="field" style={{ maxWidth: "320px" }}>
        <input
          type="text"
          value={rechercheClient}
          onChange={(e) => setRechercheClient(e.target.value)}
          placeholder="Rechercher un client ou une entreprise..."
        />
      </div>

      <div className="admin-list">
        {comptesFiltres.map((compte) => (
          <div className="admin-row" key={compte.userId} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <div className="admin-row-main">
                <div className="admin-row-title">{compte.profil?.full_name || compte.email || "(sans nom)"}</div>
                <div className="admin-row-sub">
                  {compte.email || "Courriel inconnu"} · {compte.entreprises.length}/
                  {limiteEntreprises(compte.profil?.forfait) === Infinity ? "∞" : limiteEntreprises(compte.profil?.forfait)}{" "}
                  entreprise{compte.entreprises.length > 1 ? "s" : ""}
                </div>
              </div>

              <div className="admin-row-controls">
                {compte.profil && (
                  <div style={{ minWidth: "190px" }}>
                    <SimpleSelect
                      options={optionsForfaits(forfaitsDb, compte.profil.forfait)}
                      value={compte.profil.forfait || ""}
                      onChange={(id) => handleForfaitChangeCompte(compte.profil.id, id)}
                    />
                    {forfaitsDb && (
                      <AbonnementPersonnalise
                        profilId={compte.profil.id}
                        onCree={() => {
                          rechargerListeForfaits();
                          load();
                        }}
                      />
                    )}
                    {compte.profil.stripe_subscription_id && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", fontSize: "11.5px", color: "var(--text-dim)" }}>
                        <InfoTooltip symbole="!" alerte>
                          Si le forfait est changé depuis ici, il reviendra à celui payé au prochain paiement
                          (renouvellement, etc.). Pour un changement durable, modifie l'abonnement dans Stripe.
                        </InfoTooltip>
                        Abonnement Stripe actif
                      </div>
                    )}
                  </div>
                )}

                {compte.profil ? (
                  <label className="switch" title={compte.profil.desactive ? "Compte désactivé" : "Compte actif"}>
                    <input
                      type="checkbox"
                      checked={!compte.profil.desactive}
                      onChange={(e) => handleToggleActif(compte.profil.id, !e.target.checked)}
                    />
                    <span className="switch-track"></span>
                    <span className="switch-thumb"></span>
                  </label>
                ) : (
                  <span className="admin-status-pill inactive">Profil introuvable</span>
                )}

                <button
                  className="admin-icon-btn"
                  onClick={() => (editingCompteId === compte.userId ? setEditingCompteId(null) : startEditCompte(compte))}
                >
                  {editingCompteId === compte.userId ? "Fermer" : "Modifier"}
                </button>
                {compte.profil && (
                  <button
                    className="admin-icon-btn"
                    onClick={() => setFactureCompteId(factureCompteId === compte.userId ? null : compte.userId)}
                  >
                    {factureCompteId === compte.userId ? "Fermer la facture" : "Créer une facture"}
                  </button>
                )}
                <button className="submit-btn" style={{ padding: "8px 18px" }} onClick={() => setCompteOuvertId(compte.userId)}>
                  Voir les entreprises <IconFlecheDroite className="gozly-icon-inline" />
                </button>
              </div>
            </div>

            {factureCompteId === compte.userId && <FactureCompte compte={compte} />}

            {editingCompteId === compte.userId && (
              <div className="admin-edit-panel">
                <div className="field-row">
                  <div className="field">
                    <label>Nom du client</label>
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Téléphone personnel</label>
                    <input
                      type="tel"
                      value={editForm.telephonePerso}
                      onChange={(e) => setEditForm((f) => ({ ...f, telephonePerso: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Courriel de connexion</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    disabled={!compte.profil}
                  />
                </div>

                <div className="admin-edit-actions">
                  <button className="submit-btn" onClick={() => handleSaveCompte(compte)} disabled={saving}>
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </button>
                  {compte.profil && (
                    <button className="admin-icon-btn" onClick={() => handleResetPassword(compte)}>
                      Réinitialiser le mot de passe
                    </button>
                  )}
                </div>

                {compte.profil && <DoubleAuthAdmin userId={compte.profil.id} />}

                {resetResult[compte.userId] && (
                  <div className="admin-reset-result">
                    Nouveau mot de passe temporaire : <strong>{resetResult[compte.userId]}</strong>
                    <br />
                    Transmets-le au client de vive voix — il ne sera plus affiché une fois cette page quittée.
                  </div>
                )}

                <div className="settings-divider">Zone dangereuse</div>

                {confirmingDeleteCompte !== compte.userId ? (
                  <div className="danger-zone">
                    <div>
                      <h4>Supprimer ce compte</h4>
                      <p>
                        Efface le compte de connexion et toutes les entreprises dont il est l'unique membre. Les
                        entreprises partagées avec d'autres membres ne sont pas touchées.
                      </p>
                    </div>
                    <button className="btn-danger" onClick={() => setConfirmingDeleteCompte(compte.userId)}>
                      Supprimer le compte
                    </button>
                  </div>
                ) : (
                  <div className="danger-zone" style={{ flexDirection: "column", alignItems: "stretch", gap: "12px" }}>
                    <div>
                      <h4>Confirmer la suppression</h4>
                      <p>
                        Tape le courriel du compte (<strong>{compte.email}</strong>) pour confirmer. Cette action est
                        irréversible.
                      </p>
                    </div>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={compte.email || ""}
                    />
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        className="btn-danger"
                        disabled={deleteConfirmText !== compte.email || deleting}
                        onClick={() => handleDeleteCompte(compte)}
                      >
                        {deleting ? "Suppression..." : "Confirmer la suppression définitive"}
                      </button>
                      <button
                        className="admin-icon-btn"
                        onClick={() => {
                          setConfirmingDeleteCompte(null);
                          setDeleteConfirmText("");
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {comptes.length === 0 && <div className="admin-empty">Aucun client pour l'instant.</div>}
        {comptes.length > 0 && comptesFiltres.length === 0 && (
          <div className="admin-empty">Aucun client ne correspond à "{rechercheClient}".</div>
        )}
      </div>

      {entreprisesOrphelines.length > 0 && (
        <>
          <div className="settings-divider">Entreprises sans compte lié</div>
          <p className="panel-hint">
            Ne devrait normalement pas arriver - ces entreprises n'ont aucun membre associé.
          </p>
          <div className="admin-list">
            {entreprisesOrphelines.map((entreprise) => (
              <EntrepriseRow
                key={entreprise.id}
                entreprise={entreprise}
                profilId={null}
                forfaitEditable
                forfaits={optionsForfaits(forfaitsDb, entreprise.forfait)}
                onForfaitChange={handleForfaitChangeOrphelin}
                onSaved={load}
                onDeleted={load}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
