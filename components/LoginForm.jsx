"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { IconFlecheGauche } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import Gozyx from "@/components/Gozyx";
import { useGozyxFormulaire } from "@/lib/useGozyxFormulaire";

export default function LoginForm() {
  const { t } = useT();
  const gozyx = useGozyxFormulaire();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

    const { data: profil } = await supabase
      .from("profils")
      .select("desactive")
      .eq("id", data.user.id)
      .maybeSingle();

    setLoading(false);

    if (profil?.desactive) {
      await supabase.auth.signOut();
      setError(t("login.desactiveContact"));
      return;
    }

    // ?retour=/gestion : revient là où on voulait aller (chemins internes seulement).
    const retour = new URLSearchParams(window.location.search).get("retour");
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
