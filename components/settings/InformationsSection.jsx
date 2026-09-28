"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Informations PERSONNELLES du compte uniquement - le logo, le nom, le
// secteur d'activité et les coordonnées de l'entreprise se gèrent
// maintenant depuis Entreprise > Informations (un compte peut posséder
// plusieurs entreprises distinctes, chacune avec les siennes).
export default function InformationsSection({ user, profil, setProfil }) {
  const fileInputRef = useRef(null);

  const [prenom, setPrenom] = useState(profil?.prenom || "");
  const [nom, setNom] = useState(profil?.nom || "");
  const [telephonePerso, setTelephonePerso] = useState(profil?.telephone_perso || "");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState(null);

  const [pwdStatus, setPwdStatus] = useState("idle");
  const [pwdMsg, setPwdMsg] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const fullName = `${prenom} ${nom}`.trim();

    // "full_name" reste rempli en plus de prenom/nom, pour ne pas casser les
    // nombreux endroits de l'app qui affichent déjà ce champ (barre
    // latérale, panneau admin, discussion, etc.).
    const { error: authError } = await supabase.auth.updateUser({ data: { full_name: fullName } });

    let profilError = null;
    if (profil) {
      const champs = { prenom: prenom || null, nom: nom || null, full_name: fullName, telephone_perso: telephonePerso || null };
      const { error } = await supabase.from("profils").update(champs).eq("id", profil.id);
      profilError = error;
      if (!error) setProfil({ ...profil, ...champs });
    }

    setSaving(false);

    if (authError || profilError) {
      setMsg({ type: "err", text: "La mise à jour a échoué. Réessaie dans un instant." });
      return;
    }
    setMsg({ type: "ok", text: "Modifications enregistrées !" });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file || !profil) return;

    setUploadingAvatar(true);
    setAvatarMsg(null);

    const ext = file.name.split(".").pop();
    const path = `avatars/${profil.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setUploadingAvatar(false);
      setAvatarMsg({ type: "err", text: "L'envoi de la photo a échoué. Réessaie." });
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(path);
    const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase.from("profils").update({ avatar_url: avatarUrl }).eq("id", profil.id);

    setUploadingAvatar(false);

    if (updateError) {
      setAvatarMsg({ type: "err", text: "La photo a été envoyée, mais n'a pas pu être enregistrée." });
      return;
    }

    setProfil({ ...profil, avatar_url: avatarUrl });
    setAvatarMsg({ type: "ok", text: "Photo de profil mise à jour !" });
    setTimeout(() => setAvatarMsg(null), 3000);
  }

  async function handlePasswordReset() {
    if (!user?.email) return;
    setPwdStatus("sending");
    setPwdMsg(null);

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
    });

    setPwdStatus("idle");

    if (error) {
      setPwdMsg({ type: "err", text: "L'envoi a échoué. Réessaie dans un instant." });
      return;
    }
    setPwdMsg({
      type: "ok",
      text: `Un lien de réinitialisation a été envoyé à ${user.email}. Vérifie ta boîte courriel.`,
    });
  }

  return (
    <div>
      <h2>Informations</h2>
      <p className="panel-hint">Ta photo, ton nom et tes coordonnées personnelles.</p>

      <form onSubmit={handleSave}>
        <div className="settings-section">
          <h3>Général</h3>

          <div className="avatar-upload">
            <div className="avatar-preview">
              {profil?.avatar_url ? (
                <img src={profil.avatar_url} alt="Photo de profil" />
              ) : (
                (prenom || nom || "?").charAt(0).toUpperCase()
              )}
            </div>
            <div className="avatar-actions">
              <button
                type="button"
                className="btn-small"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar || !profil}
              >
                {uploadingAvatar ? "Envoi..." : "Changer la photo"}
              </button>
              <span style={{ fontSize: "12px", color: "var(--text-dim)" }}>PNG ou JPG, carré de préférence</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
            </div>
          </div>
          {avatarMsg && <p className={`settings-msg ${avatarMsg.type}`}>{avatarMsg.text}</p>}

          <div className="field-row" style={{ marginTop: "18px" }}>
            <div className="field">
              <label htmlFor="prenom">Prénom</label>
              <input type="text" id="prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom" />
            </div>
            <div className="field">
              <label htmlFor="nom">Nom de famille</label>
              <input type="text" id="nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de famille" />
            </div>
          </div>
        </div>

        <div className="settings-divider">Contact</div>

        <div className="settings-section">
          <p className="section-hint">Tes propres coordonnées, distinctes de celles de tes entreprises.</p>

          <div className="field">
            <label>Courriel de connexion</label>
            <input type="email" value={user?.email || ""} disabled />
          </div>

          <div className="field">
            <label htmlFor="telephonePerso">Téléphone personnel (optionnel)</label>
            <input
              type="tel"
              id="telephonePerso"
              value={telephonePerso}
              onChange={(e) => setTelephonePerso(e.target.value)}
              placeholder="(514) 000-0000"
            />
          </div>
        </div>

        <div className="submit-wrap">
          <button type="submit" className="submit-btn" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
        {msg && <p className={`settings-msg ${msg.type}`} style={{ textAlign: "center" }}>{msg.text}</p>}
      </form>

      <div className="settings-divider">Sécurité</div>

      <div className="settings-section">
        <h3>Mot de passe</h3>
        <p className="section-hint">
          Pour ta sécurité, le changement de mot de passe se fait par un lien envoyé à ton courriel.
        </p>
        <button
          type="button"
          className="btn-small"
          onClick={handlePasswordReset}
          disabled={pwdStatus === "sending"}
        >
          {pwdStatus === "sending" ? "Envoi..." : "Envoyer un lien de réinitialisation"}
        </button>
        {pwdMsg && <p className={`settings-msg ${pwdMsg.type}`}>{pwdMsg.text}</p>}
      </div>
    </div>
  );
}
