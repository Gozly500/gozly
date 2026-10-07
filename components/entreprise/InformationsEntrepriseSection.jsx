"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { geocoderAdresse } from "@/lib/geocode";
import { IconAttention } from "@/components/icons/Pictogrammes";

async function authFetch(path, options = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Les informations de L'ENTREPRISE (logo, nom, secteur, adresse, contact) -
// avant, elles vivaient dans Paramètres du compte, ce qui n'avait plus de
// sens une fois qu'un compte peut posséder plusieurs entreprises distinctes.
// Chaque entreprise gère maintenant les siennes ici.
export default function InformationsEntrepriseSection({ entrepriseId, userId }) {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [entreprise, setEntreprise] = useState(null);
  const [monRole, setMonRole] = useState(null);

  const [nom, setNom] = useState("");
  const [secteurActivite, setSecteurActivite] = useState("");
  const [adresse, setAdresse] = useState("");
  const [courrielContact, setCourrielContact] = useState("");
  const [telephone, setTelephone] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [adresseIntrouvable, setAdresseIntrouvable] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const [{ data: e }, { data: membre }] = await Promise.all([
      supabase.from("entreprises").select("*").eq("id", entrepriseId).maybeSingle(),
      supabase.from("membres").select("role").eq("entreprise_id", entrepriseId).eq("user_id", userId).maybeSingle(),
    ]);
    setEntreprise(e || null);
    setMonRole(membre?.role || null);
    setNom(e?.nom || "");
    setSecteurActivite(e?.secteur_activite || "");
    setAdresse(e?.adresse || "");
    setCourrielContact(e?.courriel_contact || "");
    setTelephone(e?.telephone || "");
    setLoading(false);
  }

  async function handleSave(ev) {
    ev.preventDefault();
    setSaving(true);
    setMsg(null);
    setAdresseIntrouvable(false);

    // Même mécanisme que pour les succursales (Emplacements) : l'adresse est
    // convertie en coordonnées GPS via Nominatim à l'enregistrement.
    let position = null;
    if (adresse.trim() && adresse.trim() !== (entreprise?.adresse || "").trim()) {
      position = await geocoderAdresse(adresse);
      if (!position) setAdresseIntrouvable(true);
    }

    const champs = {
      nom,
      secteur_activite: secteurActivite || null,
      adresse: adresse || null,
      courriel_contact: courrielContact || null,
      telephone: telephone || null,
    };
    if (!adresse.trim()) {
      champs.latitude = null;
      champs.longitude = null;
    } else if (position) {
      champs.latitude = position.latitude;
      champs.longitude = position.longitude;
    }

    const { error } = await supabase.from("entreprises").update(champs).eq("id", entrepriseId);
    setSaving(false);

    if (error) {
      setMsg({ type: "err", text: "La mise à jour a échoué. Réessaie dans un instant." });
      return;
    }
    setEntreprise((prev) => ({ ...prev, ...champs }));
    setMsg({ type: "ok", text: "Modifications enregistrées !" });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setLogoMsg(null);

    const ext = file.name.split(".").pop();
    const path = `${entrepriseId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setUploadingLogo(false);
      setLogoMsg({ type: "err", text: "L'envoi du logo a échoué. Réessaie." });
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(path);
    const logoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase.from("entreprises").update({ logo_url: logoUrl }).eq("id", entrepriseId);

    setUploadingLogo(false);

    if (updateError) {
      setLogoMsg({ type: "err", text: "Le logo a été envoyé, mais n'a pas pu être enregistré." });
      return;
    }

    setEntreprise((prev) => ({ ...prev, logo_url: logoUrl }));
    setLogoMsg({ type: "ok", text: "Logo mis à jour !" });
    setTimeout(() => setLogoMsg(null), 3000);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const { ok, data } = await authFetch("/api/entreprise/supprimer", {
      method: "POST",
      body: JSON.stringify({ entrepriseId }),
    });
    setDeleting(false);

    if (!ok) {
      setDeleteError(data.error || "La suppression a échoué.");
      return;
    }

    router.push("/dashboards");
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Informations</h2>
      <p className="panel-hint">Le logo, le nom et les coordonnées de cette entreprise.</p>

      <form onSubmit={handleSave}>
        <div className="settings-section">
          <h3>Général</h3>

          <div className="avatar-upload">
            <div className="avatar-preview">
              {entreprise?.logo_url ? (
                <img src={entreprise.logo_url} alt="Logo de l'entreprise" />
              ) : (
                (nom || "?").charAt(0).toUpperCase()
              )}
            </div>
            <div className="avatar-actions">
              <button type="button" className="btn-small" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                {uploadingLogo ? "Envoi..." : "Changer le logo"}
              </button>
              <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>PNG ou JPG, carré de préférence</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={handleLogoChange}
              />
            </div>
          </div>
          {logoMsg && <p className={`settings-msg ${logoMsg.type}`}>{logoMsg.text}</p>}

          <div className="field-row" style={{ marginTop: "18px" }}>
            <div className="field">
              <label htmlFor="nom-entreprise">Nom de l'entreprise</label>
              <input type="text" id="nom-entreprise" value={nom} onChange={(e) => setNom(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="secteur">Secteur d'activité</label>
              <input
                type="text"
                id="secteur"
                value={secteurActivite}
                onChange={(e) => setSecteurActivite(e.target.value)}
                placeholder="Ex: Restauration, Détail, Construction..."
              />
            </div>
          </div>
        </div>

        <div className="settings-divider">Contact</div>

        <div className="settings-section">
          <p className="section-hint">Ces informations servent à contacter l'entreprise.</p>

          <div className="field">
            <label htmlFor="adresse-entreprise">Adresse physique</label>
            <input
              type="text"
              id="adresse-entreprise"
              value={adresse}
              onChange={(e) => {
                setAdresse(e.target.value);
                setAdresseIntrouvable(false);
              }}
              placeholder="123 rue Exemple, Ville, Province"
            />
            {adresseIntrouvable && (
              <p className="section-hint" style={{ color: "#f2b95a", marginTop: "4px" }}>
                <IconAttention className="gozly-icon" /> Adresse introuvable - vérifie l'orthographe. Enregistrée quand même.
              </p>
            )}
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="courriel-entreprise">Courriel de contact</label>
              <input
                type="email"
                id="courriel-entreprise"
                value={courrielContact}
                onChange={(e) => setCourrielContact(e.target.value)}
                placeholder="contact@entreprise.com"
              />
            </div>
            <div className="field">
              <label htmlFor="telephone-entreprise">Téléphone</label>
              <input
                type="tel"
                id="telephone-entreprise"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="(514) 000-0000"
              />
            </div>
          </div>
        </div>

        <div className="submit-wrap">
          <button type="submit" className="submit-btn" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
        {msg && (
          <p className={`settings-msg ${msg.type}`} style={{ textAlign: "center" }}>
            {msg.text}
          </p>
        )}
      </form>

      {monRole === "proprietaire" && (
        <>
          <div className="settings-divider">Zone dangereuse</div>

          {!confirmingDelete ? (
            <div className="danger-zone">
              <div>
                <h4>Supprimer cette entreprise</h4>
                <p>
                  Efface définitivement cette entreprise et toutes ses données (planning, employés, etc). Le compte
                  de connexion et tes autres entreprises ne sont pas touchés.
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
                  Tape le nom de l'entreprise (<strong>{entreprise?.nom}</strong>) pour confirmer. Cette action est
                  irréversible.
                </p>
              </div>
              {deleteError && <p className="settings-msg err">{deleteError}</p>}
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={entreprise?.nom}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn-danger"
                  disabled={deleteConfirmText !== entreprise?.nom || deleting}
                  onClick={handleDelete}
                >
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
        </>
      )}
    </div>
  );
}
