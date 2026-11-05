"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { IconFlecheGauche } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import Gozyx from "@/components/Gozyx";
import { useGozyxFormulaire } from "@/lib/useGozyxFormulaire";
import CodeDoubleAuth from "@/components/CodeDoubleAuth";

export default function LoginForm() {
  const { t } = useT();
  const gozyx = useGozyxFormulaire();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Double authentification : { factorId } quand le mot de passe est bon mais qu'il reste à entrer le code de l'app.
  const [defi, setDefi] = useState(null);
  const [codeDA, setCodeDA] = useState("");

  const [motDePasseOublie, setMotDePasseOublie] = useState(false);
  const [emailOubli, setEmailOubli] = useState("");
  const [envoiStatut, setEnvoiStatut] = useState("idle"); // "idle" | "envoi" | "envoye" | "erreur"

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("desactive") === "1") {
      setError(t("login.desactive"));
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setError(t("login.errIdentifiants"));
      return;
    }

    const { data: niveau } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (niveau?.nextLevel === "aal2" && niveau.currentLevel !== "aal2") {
      const { data: facteurs } = await supabase.auth.mfa.listFactors();
      const verifies = (facteurs?.all || []).filter((f) => f.status === "verified");
      const app = verifies.find((f) => f.factor_type === "totp");
      const appareil = verifies.find((f) => f.factor_type === "webauthn");
      if (app || appareil) {
        setLoading(false);
        setCodeDA("");
        setDefi({ appId: app?.id || null, appareilId: appareil?.id || null, userId: data.user.id });
        return;
      }
    }

    await terminerConnexion(data.user.id);
  }

  async function handleCode(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: defi.appId, code: codeDA });
    if (error) {
      setLoading(false);
      setCodeDA("");
      setError(t("login.errCode"));
      return;
    }
    await terminerConnexion(defi.userId);
  }

  async function handleAppareil() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.mfa.webauthn.authenticate({ factorId: defi.appareilId });
    if (error) {
      setLoading(false);
      const annule = /NotAllowed|abort|cancel/i.test(`${error.name} ${error.message}`);
      setError(annule ? t("login.errAppareilAnnule") : t("login.errAppareil"));
      return;
    }
    await terminerConnexion(defi.userId);
  }

  async function annulerCode() {
    await supabase.auth.signOut();
    setDefi(null);
    setCodeDA("");
    setError("");
    setPassword("");
  }

  async function terminerConnexion(userId) {
    setLoading(true);
    const { data: profil } = await supabase
      .from("profils")
      .select("desactive")
      .eq("id", userId)
      .maybeSingle();

    setLoading(false);

    if (profil?.desactive) {
      await supabase.auth.signOut();
      setDefi(null);
      setError(t("login.desactiveContact"));
      return;
    }

    // ?retour=/gestion : revient là où on voulait aller (chemins internes seulement).
    const retour = new URLSearchParams(window.location.search).get("retour");
    // Petit saut de joie de Gozyx avant de continuer.
    gozyx.succes();
    await new Promise((r) => setTimeout(r, 1100));
    router.push(retour && retour.startsWith("/") && !retour.startsWith("//") ? retour : "/dashboard");
  }

  function ouvrirMotDePasseOublie() {
    setEmailOubli(email);
    setEnvoiStatut("idle");
    setMotDePasseOublie(true);
  }

  async function handleEnvoyerReinitialisation(e) {
    e.preventDefault();
    setEnvoiStatut("envoi");

    const { error } = await supabase.auth.resetPasswordForEmail(emailOubli, {
      redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
    });

    setEnvoiStatut(error ? "erreur" : "envoye");
  }

  if (defi) {
    return (
      <div className="contact-card login-card">
        <form onSubmit={handleCode}>
          <p className="section-hint" style={{ textAlign: "center", marginBottom: "18px" }}>
            {defi.appareilId ? t("login.verifHint") : t("login.codeHint")}
          </p>
          {defi.appareilId && (
            <div className="submit-wrap">
              <button type="button" className="submit-btn" onClick={handleAppareil} disabled={loading}>
                {t("login.appareilBouton")}
              </button>
            </div>
          )}
          {defi.appareilId && defi.appId && (
            <p className="section-hint" style={{ textAlign: "center", margin: "16px 0 6px" }}>{t("login.ou")}</p>
          )}
          {defi.appId && (
            <>
              <div className="field">
                <label htmlFor="code-da-login">{t("login.code")}</label>
                <CodeDoubleAuth id="code-da-login" value={codeDA} onChange={setCodeDA} disabled={loading} autoFocus={!defi.appareilId} />
              </div>
              <div className="submit-wrap">
                <button type="submit" className="submit-btn" disabled={loading || codeDA.length !== 6}>
                  {loading ? t("login.chargement") : t("login.codeBouton")}
                </button>
              </div>
            </>
          )}
          {error && (
            <p style={{ color: "#ff8a8a", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>{error}</p>
          )}
          <p style={{ color: "var(--text-dim)", textAlign: "center", marginTop: "18px", fontSize: "13.5px" }}>
            <button
              type="button"
              onClick={annulerCode}
              style={{ background: "none", border: "none", padding: 0, textDecoration: "underline", color: "var(--fg)", cursor: "pointer", font: "inherit" }}
            >
              <IconFlecheGauche className="gozly-icon" /> {t("login.retour")}
            </button>
          </p>
          <p className="section-hint" style={{ textAlign: "center", marginTop: "10px" }}>{t("login.codePerdu")}</p>
        </form>
      </div>
    );
  }

  if (motDePasseOublie) {
    return (
      <div className="contact-card login-card">
        {envoiStatut === "envoye" ? (
          <p style={{ color: "#7ee787", textAlign: "center" }}>
            {t("login.oubliEnvoye")}
          </p>
        ) : (
          <form onSubmit={handleEnvoyerReinitialisation}>
            <p className="section-hint" style={{ textAlign: "center", marginBottom: "18px" }}>
              {t("login.oubliHint")}
            </p>
            <div className="field">
              <label htmlFor="email-oublie">{t("login.courriel")}</label>
              <input
                type="email"
                id="email-oublie"
                value={emailOubli}
                onChange={(e) => setEmailOubli(e.target.value)}
                placeholder={t("login.courrielPh")}
                required
              />
            </div>
            <div className="submit-wrap">
              <button type="submit" className="submit-btn" disabled={envoiStatut === "envoi"}>
                {envoiStatut === "envoi" ? t("login.oubliEnvoi") : t("login.oubliBouton")}
              </button>
            </div>
            {envoiStatut === "erreur" && (
              <p style={{ color: "#ff8a8a", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>
                {t("login.oubliErreur")}
              </p>
            )}
          </form>
        )}
        <p style={{ color: "var(--text-dim)", textAlign: "center", marginTop: "18px", fontSize: "13.5px" }}>
          <button
            type="button"
            onClick={() => setMotDePasseOublie(false)}
            style={{ background: "none", border: "none", padding: 0, textDecoration: "underline", color: "var(--fg)", cursor: "pointer", font: "inherit" }}
          >
            <IconFlecheGauche className="gozly-icon" /> {t("login.retour")}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="contact-card login-card">
      <div className="form-gozyx">
        <Gozyx humeur={gozyx.humeur} regard={gozyx.regard} taille={110} />
      </div>
      <form onSubmit={handleSubmit} {...gozyx.handlers}>
        <div className="field">
          <label htmlFor="email">{t("login.courriel")}</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("login.courrielPh")}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t("login.mdp")}</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <div className="submit-wrap">
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? t("login.chargement") : t("login.bouton")}
          </button>
        </div>
        {error && (
          <p style={{ color: "#ff8a8a", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>
            {error}
          </p>
        )}
        <p style={{ color: "var(--text-dim)", textAlign: "center", marginTop: "14px", fontSize: "13.5px" }}>
          <button
            type="button"
            onClick={ouvrirMotDePasseOublie}
            style={{ background: "none", border: "none", padding: 0, textDecoration: "underline", color: "var(--text-dim)", cursor: "pointer", font: "inherit" }}
          >
            {t("login.oublie")}
          </button>
        </p>
        <p style={{ color: "var(--text-dim)", textAlign: "center", marginTop: "10px", fontSize: "13.5px" }}>
          {t("login.pasDeCompte")}{" "}
          <a href="/inscription" style={{ textDecoration: "underline", color: "var(--fg)" }}>
            {t("login.creer")}
          </a>
        </p>
      </form>
    </div>
  );
}
