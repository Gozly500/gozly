"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError("Courriel ou mot de passe incorrect.");
      return;
    }

    router.push("/dashboard");
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
        <p style={{ color: "var(--text-dim)", textAlign: "center", marginTop: "18px", fontSize: "13.5px" }}>
          Pas encore de compte?{" "}
          <a href="/inscription" style={{ textDecoration: "underline", color: "#fff" }}>
            Crée-en un
          </a>
        </p>
      </form>
    </div>
  );
}
