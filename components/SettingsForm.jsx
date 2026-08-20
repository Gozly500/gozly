"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SettingsForm() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setFullName(session.user.user_metadata?.full_name || "");
      setEmail(session.user.email || "");
      setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    setError("");

    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });

    if (error) {
      setStatus("idle");
      setError("La mise à jour a échoué. Réessaie dans un instant.");
      return;
    }

    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2500);
  }

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="contact-card login-card">
      <form onSubmit={handleSubmit}>
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
          <label htmlFor="email">Courriel</label>
          <input type="email" id="email" value={email} disabled />
        </div>
        <div className="submit-wrap">
          <button type="submit" className="submit-btn" disabled={status === "saving"}>
            {status === "saving" ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
        {status === "saved" && (
          <p style={{ color: "#7ee787", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>
            Modifications enregistrées!
          </p>
        )}
        {error && (
          <p style={{ color: "#ff8a8a", textAlign: "center", marginTop: "14px", fontSize: "14px" }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
