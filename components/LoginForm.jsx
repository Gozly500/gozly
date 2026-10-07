"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { IconFlecheGauche } from "@/components/icons/Pictogrammes";

export default function LoginForm() {
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
      setError("Ce compte a été désactivé.");
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setError("Courriel ou mot de passe incorrect.");
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
      setError("Ce compte a été désactivé. Contacte-nous si c'est une erreur.");
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
            Si un compte existe avec cette adresse, un lien de réinitialisation vient d'être envoyé par courriel.
          </p>
        ) : (
          <form onSubmit={handleEnvoyerReinitialisation}>
            <p className="section-hint" style={{ textAlign: "center", marginBottom: "18px" }}>
              Entre ton courriel - on t'envoie un lien pour choisir un nouveau mot de passe.
            </p>
            <div className="field">
              <label htmlFor="email-oublie">Courriel</label>
              <input
                type="email"
                id="email-oublie"
                value={emailOubli}
                onChange={(e) => setEmailOubli(e.target.value)}
                placeholder="ton@courriel.com"
                required
              />
            </div>
            <div className="submit-wrap">
              <button type="submit" className="submit-btn" disabled={envoiStatut === "envoi"}>
                {envoiStatut === "envoi" ? "Envoi..." : "Envoyer le lien"}
              </button>
            </div>
            {envoiStatut === "erreur" && (
              <p style={{ color: "#ff8a8a", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>
                L'envoi a échoué. Réessaie dans un instant.
              </p>
            )}
          </form>
        )}
        <p style={{ color: "var(--text-dim)", textAlign: "center", marginTop: "18px", fontSize: "13.5px" }}>
          <button
            type="button"
            onClick={() => setMotDePasseOublie(false)}
            style={{ background: "none", border: "none", padding: 0, textDecoration: "underline", color: "#fff", cursor: "pointer", font: "inherit" }}
          >
            <IconFlecheGauche className="gozly-icon" /> Retour à la connexion
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="contact-card login-card">
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Courriel</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@courriel.com"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Mot de passe</label>
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
            {loading ? "Connexion..." : "Se connecter"}
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
            Mot de passe oublié ?
          </button>
        </p>
        <p style={{ color: "var(--text-dim)", textAlign: "center", marginTop: "10px", fontSize: "13.5px" }}>
          Pas encore de compte?{" "}
          <a href="/inscription" style={{ textDecoration: "underline", color: "#fff" }}>
            Crée-en un
          </a>
        </p>
      </form>
    </div>
  );
}
