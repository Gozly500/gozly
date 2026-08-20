"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setStatus("saving");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setStatus("idle");

    if (updateError) {
      setError("La mise à jour a échoué. Redemande un lien depuis les paramètres.");
      return;
    }

    setStatus("done");
    setTimeout(() => router.push("/dashboard"), 1800);
  }

  if (!ready) {
    return (
      <div className="contact-card login-card">
        <p style={{ color: "var(--text-dim)", textAlign: "center" }}>
          Ce lien de réinitialisation est invalide ou a expiré. Redemande-en un depuis la page
          Paramètres du compte.
        </p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="contact-card login-card">
        <p style={{ color: "#7ee787", textAlign: "center" }}>
          Mot de passe mis à jour ! Redirection vers ton tableau de bord...
        </p>
      </div>
    );
  }

  return (
    <div className="contact-card login-card">
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="password">Nouveau mot de passe</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 caractères"
            minLength={6}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirme le mot de passe</label>
          <input
            type="password"
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Retape le mot de passe"
            minLength={6}
            required
          />
        </div>
        <div className="submit-wrap">
          <button type="submit" className="submit-btn" disabled={status === "saving"}>
            {status === "saving" ? "Enregistrement..." : "Mettre à jour le mot de passe"}
          </button>
        </div>
        {error && (
          <p style={{ color: "#ff8a8a", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
