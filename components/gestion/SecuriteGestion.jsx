"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import CodeDoubleAuth from "@/components/CodeDoubleAuth";
import { useT } from "@/components/LangProvider";

// Double authentification (app d'authentification : Google Authenticator, Microsoft Authenticator, etc.).
// Activer : on scanne le code QR, on entre le code à 6 chiffres pour confirmer. Désactiver : demande un code valide.
// Si le client perd son téléphone, l'équipe Gozly la désactive depuis l'administration (Clients).
export default function SecuriteGestion() {
  const { t } = useT();
  const [etat, setEtat] = useState(null); // null = chargement | { facteurId } (null si la double authentification est désactivée)
  const [inscription, setInscription] = useState(null); // { id, qr, secret } pendant l'activation
  const [code, setCode] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmerRetrait, setConfirmerRetrait] = useState(false);

  async function charger() {
    const { data } = await supabase.auth.mfa.listFactors();
    const verifie = (data?.totp || []).find((f) => f.status === "verified");
    setEtat({ facteurId: verifie?.id || null });
  }

  useEffect(() => {
    charger();
  }, []);

  async function commencer() {
    setMsg(null);
    setOccupe(true);
    // Une activation abandonnée plus tôt laisse un facteur non confirmé : on le retire avant d'en créer un nouveau.
    const { data: liste } = await supabase.auth.mfa.listFactors();
    for (const f of (liste?.all || []).filter((x) => x.factor_type === "totp" && x.status !== "verified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Gozly ${Date.now()}` });
    setOccupe(false);
    if (error || !data) {
      setMsg({ type: "err", text: t("Impossible de commencer l'activation.") });
      return;
    }
    setCode("");
    setInscription({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmer(e) {
    e.preventDefault();
    setMsg(null);
    setOccupe(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: inscription.id, code });
    setOccupe(false);
    if (error) {
      setMsg({ type: "err", text: t("Code invalide. Réessaie avec le code actuel de ton app.") });
      setCode("");
      return;
    }
    setInscription(null);
    setCode("");
    setMsg({ type: "ok", text: t("Double authentification activée.") });
    charger();
  }

  async function annuler() {
    if (inscription) await supabase.auth.mfa.unenroll({ factorId: inscription.id }).catch(() => {});
    setInscription(null);
    setCode("");
    setMsg(null);
  }

  async function desactiver(e) {
    e.preventDefault();
    setMsg(null);
    setOccupe(true);
    const verif = await supabase.auth.mfa.challengeAndVerify({ factorId: etat.facteurId, code });
    if (verif.error) {
      setOccupe(false);
      setMsg({ type: "err", text: t("Code invalide. Réessaie avec le code actuel de ton app.") });
      setCode("");
      return;
    }
    const { error } = await supabase.auth.mfa.unenroll({ factorId: etat.facteurId });
    setOccupe(false);
    setCode("");
    setConfirmerRetrait(false);
    if (error) {
      setMsg({ type: "err", text: t("La désactivation a échoué.") });
      return;
    }
    setMsg({ type: "ok", text: t("Double authentification désactivée.") });
    charger();
  }

  if (!etat) return <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>;

  return (
    <div className="gestion-section">
      <h2 style={{ marginBottom: "4px" }}>{t("Sécurité")}</h2>
      <p className="section-hint">{t("Double authentification")}</p>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {inscription ? (
        <form className="da-carte" onSubmit={confirmer}>
          <p>{t("Ouvre ton app d'authentification (Google Authenticator, Microsoft Authenticator...) et scanne ce code.")}</p>
          <img className="da-qr" src={inscription.qr} alt="" />
          <p className="da-secret">
            {t("Pas de caméra ? Entre cette clé :")} <code>{inscription.secret}</code>
          </p>
          <label htmlFor="code-da-activation" className="da-etiquette">
            {t("Code à 6 chiffres")}
          </label>
          <CodeDoubleAuth id="code-da-activation" value={code} onChange={setCode} disabled={occupe} autoFocus={false} />
          <div className="da-actions">
            <button type="submit" className="submit-btn" disabled={occupe || code.length !== 6}>
              {t("Activer")}
            </button>
            <button type="button" className="admin-icon-btn" onClick={annuler} disabled={occupe}>
              {t("Annuler")}
            </button>
          </div>
        </form>
      ) : etat.facteurId ? (
        <div className="da-carte">
          <p className="da-etat actif">{t("Activée : un code est demandé à chaque connexion.")}</p>
          {confirmerRetrait ? (
            <form onSubmit={desactiver}>
              <label htmlFor="code-da-retrait" className="da-etiquette">
                {t("Entre un code pour confirmer")}
              </label>
              <CodeDoubleAuth id="code-da-retrait" value={code} onChange={setCode} disabled={occupe} />
              <div className="da-actions">
                <button type="submit" className="admin-icon-btn danger" disabled={occupe || code.length !== 6}>
                  {t("Désactiver")}
                </button>
                <button
                  type="button"
                  className="admin-icon-btn"
                  onClick={() => {
                    setConfirmerRetrait(false);
                    setCode("");
                    setMsg(null);
                  }}
                  disabled={occupe}
                >
                  {t("Annuler")}
                </button>
              </div>
            </form>
          ) : (
            <div className="da-actions">
              <button
                type="button"
                className="admin-icon-btn danger"
                onClick={() => {
                  setConfirmerRetrait(true);
                  setMsg(null);
                }}
              >
                {t("Désactiver")}
              </button>
            </div>
          )}
          <p className="section-hint">{t("Plus accès à ton app ? Appelle l'équipe Gozly : elle peut la désactiver pour toi.")}</p>
        </div>
      ) : (
        <div className="da-carte">
          <p className="da-etat">{t("Désactivée.")}</p>
          <p className="section-hint">{t("Ajoute un code temporaire de ton téléphone à ton mot de passe.")}</p>
          <div className="da-actions">
            <button type="button" className="submit-btn" onClick={commencer} disabled={occupe}>
              {t("Activer la double authentification")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
