"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function InformationsSection({ user, profil, setProfil, entreprise, setEntreprise }) {
  const fileInputRef = useRef(null);

  const [fullName, setFullName] = useState(profil?.full_name || "");
  const [entrepriseName, setEntrepriseName] = useState(entreprise?.nom || "");
  const [adresse, setAdresse] = useState(entreprise?.adresse || "");
  const [courrielContact, setCourrielContact] = useState(entreprise?.courriel_contact || "");
  const [telephone, setTelephone] = useState(entreprise?.telephone || "");
  const [telephonePerso, setTelephonePerso] = useState(profil?.telephone_perso || "");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState(null);

  const [pwdStatus, setPwdStatus] = useState("idle");
  const [pwdMsg, setPwdMsg] = useState(null);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });

    if (profil) {
      await supabase
        .from("profils")
        .update({ full_name: fullName, telephone_perso: telephonePerso || null })
        .eq("id", profil.id);
      setProfil({ ...profil, full_name: fullName, telephone_perso: telephonePerso || null });
    }

    let entrepriseError = null;
    if (entreprise) {
      const { error } = await supabase
        .from("entreprises")
        .update({
          nom: entrepriseName,
          adresse: adresse || null,
          courriel_contact: courrielContact || null,
          telephone: telephone || null,
        })
        .eq("id", entreprise.id);
      entrepriseError = error;
      if (!error) {
        setEntreprise({
          ...entreprise,
          nom: entrepriseName,
          adresse: adresse || null,
          courriel_contact: courrielContact || null,
          telephone: telephone || null,
        });
      }
    }

    setSaving(false);

    if (authError || entrepriseError) {
      setMsg({ type: "err", text: "La mise à jour a échoué. Réessaie dans un instant." });
      return;
    }
    setMsg({ type: "ok", text: "Modifications enregistrées !" });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file || !entreprise) return;

    setUploadingLogo(true);
    setLogoMsg(null);

    const ext = file.name.split(".").pop();
    const path = `${entreprise.id}/logo.${ext}`;

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

    const { error: updateError } = await supabase
      .from("entreprises")
      .update({ logo_url: logoUrl })
      .eq("id", entreprise.id);

    setUploadingLogo(false);

    if (updateError) {
      setLogoMsg({ type: "err", text: "Le logo a été envoyé, mais n'a pas pu être enregistré." });
      return;
    }

    setEntreprise({ ...entreprise, logo_url: logoUrl });
    setLogoMsg({ type: "ok", text: "Logo mis à jour !" });
    setTimeout(() => setLogoMsg(null), 3000);
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
      <p className="panel-hint">Gère les informations générales de ton compte et de ton entreprise.</p>

      <form onSubmit={handleSave}>
        <div className="settings-section">
          <h3>Général</h3>
          <p className="section-hint">Ton nom et le nom de ton entreprise.</p>

          <div className="avatar-upload">
            <div className="avatar-preview">
              {entreprise?.logo_url ? (
                <img src={entreprise.logo_url} alt="Logo de l'entreprise" />
              ) : (
                (entrepriseName || "?").charAt(0).toUpperCase()
              )}
            </div>
            <div className="avatar-actions">
              <button
                type="button"
                className="btn-small"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo || !entreprise}
              >
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
              <label htmlFor="fullName">Ton nom</label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ton nom"
              />
            </div>
            <div className="field">
              <label htmlFor="entrepriseName">Nom de l'entreprise</label>
              <input
                type="text"
                id="entrepriseName"
                value={entrepriseName}
                onChange={(e) => setEntrepriseName(e.target.value)}
                placeholder="Nom de l'entreprise"
                disabled={!entreprise}
              />
            </div>
          </div>
        </div>

        <div className="settings-divider">Contact</div>

        <div className="settings-section">
          <p className="section-hint">Ces informations servent à te contacter, toi ou ton entreprise.</p>

          <div className="field">
            <label htmlFor="adresse">Adresse physique de l'entreprise</label>
            <input
              type="text"
              id="adresse"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="123 rue Exemple, Ville, Province"
              disabled={!entreprise}
            />
          </div>

          <div className="field">
            <label htmlFor="courrielContact">Courriel de contact</label>
            <input
              type="email"
              id="courrielContact"
              value={courrielContact}
              onChange={(e) => setCourrielContact(e.target.value)}
              placeholder="contact@entreprise.com"
              disabled={!entreprise}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="telephone">Téléphone de l'entreprise</label>
              <input
                type="tel"
                id="telephone"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="(514) 000-0000"
                disabled={!entreprise}
              />
            </div>
            <div className="field">
              <label htmlFor="telephonePerso">Ton téléphone personnel (optionnel)</label>
              <input
                type="tel"
                id="telephonePerso"
                value={telephonePerso}
                onChange={(e) => setTelephonePerso(e.target.value)}
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
