"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";

export default function ResetPasswordForm() {
  const { t } = useT();
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
      setError(t("reset.errLongueur"));
      return;
    }
    if (password !== confirm) {
      setError(t("reset.errDifferent"));
      return;
    }

    setStatus("saving");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setStatus("idle");

    if (updateError) {
      setError(t("reset.errMaj"));
      return;
    }

    setStatus("done");
    setTimeout(() => router.push("/dashboard"), 1800);
  }

  if (!ready) {
    return (
      <div className="contact-card login-card">
        <p style={{ color: "var(--text-dim)", textAlign: "center" }}>
          {t("reset.invalide")}
        </p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="contact-card login-card">
        <p style={{ color: "#7ee787", textAlign: "center" }}>
          {t("reset.ok")}
        </p>
      </div>
    );
  }

  return (
    <div className="contact-card login-card">
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="password">{t("reset.nouveau")}</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("signup.mdpPh")}
            minLength={6}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">{t("reset.confirmer")}</label>
          <input
            type="password"
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t("reset.confirmerPh")}
            minLength={6}
            required
          />
        </div>
        <div className="submit-wrap">
          <button type="submit" className="submit-btn" disabled={status === "saving"}>
            {status === "saving" ? t("reset.enregistrement") : t("reset.bouton")}
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
