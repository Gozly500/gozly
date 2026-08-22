"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SERVICES_PAIE } from "@/lib/servicesPaie";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function IntegrationsSection() {
  const [connecte, setConnecte] = useState(false);
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({ codeEntreprise: "", codeUtilisateur: "", motDePasse: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setChecking(true);
    try {
      const res = await fetch("/api/paie/nethris/statut", { headers: await authHeaders() });
      const data = await res.json();
      setConnecte(!!data.connecte);
    } catch {
      setConnecte(false);
    }
    setChecking(false);
  }

  async function handleConnecter(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      const res = await fetch("/api/paie/nethris/connecter", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "La connexion a échoué." });
        setSaving(false);
        return;
      }

      setConnecte(true);
      setForm({ codeEntreprise: "", codeUtilisateur: "", motDePasse: "" });
      setMsg({ type: "ok", text: "Nethris est connecté." });
    } catch {
      setMsg({ type: "err", text: "La connexion a échoué." });
    }
    setSaving(false);
  }

  async function handleDeconnecter() {
    setSaving(true);
    setMsg(null);

    try {
      await fetch("/api/paie/nethris/deconnecter", { method: "POST", headers: await authHeaders() });
      setConnecte(false);
      setMsg({ type: "ok", text: "Nethris est déconnecté." });
    } catch {
      setMsg({ type: "err", text: "La déconnexion a échoué." });
    }
    setSaving(false);
  }

  return (
    <div>
      <h2>Intégrations</h2>
      <p className="panel-hint">Connecte tes services de paie pour préparer l'exportation automatique des heures.</p>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {SERVICES_PAIE.map((s) => (
        <div className="settings-section" key={s.id}>
          <h3>{s.label}</h3>

          {!s.disponible ? (
            <p className="section-hint">Bientôt disponible.</p>
          ) : checking ? (
            <p className="section-hint">Vérification du statut...</p>
          ) : connecte ? (
            <>
              <p className="section-hint">
                <span className="forfait-badge">🔌 Connecté</span>
              </p>
              <p className="section-hint" style={{ marginTop: "10px" }}>
                L'envoi automatique des heures est en préparation - en attendant, exporte le CSV Nethris depuis
                la Feuille de temps.
              </p>
              <button type="button" className="admin-icon-btn danger" onClick={handleDeconnecter} disabled={saving}>
                {saving ? "..." : "Déconnecter"}
              </button>
            </>
          ) : (
            <>
              <p className="section-hint">
                Dans Nethris : Configuration → connecteur API, puis Administration → Company Options → User
                management pour créer un utilisateur de type "service". Ça te donne les 3 identifiants
                ci-dessous.
              </p>
              <form onSubmit={handleConnecter} style={{ maxWidth: "360px" }}>
                <div className="field">
                  <label>Code d'entreprise</label>
                  <input
                    type="text"
                    value={form.codeEntreprise}
                    onChange={(e) => setForm((f) => ({ ...f, codeEntreprise: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>Code utilisateur</label>
                  <input
                    type="text"
                    value={form.codeUtilisateur}
                    onChange={(e) => setForm((f) => ({ ...f, codeUtilisateur: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>Mot de passe</label>
                  <input
                    type="password"
                    value={form.motDePasse}
                    onChange={(e) => setForm((f) => ({ ...f, motDePasse: e.target.value }))}
                    required
                  />
                </div>
                <button type="submit" className="submit-btn" disabled={saving}>
                  {saving ? "Connexion..." : "Connecter"}
                </button>
              </form>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
