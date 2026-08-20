"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminsSection({ currentEmail }) {
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("admins").select("*").order("created_at", { ascending: true });
    setAdmins(data || []);
    setLoading(false);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    const { error } = await supabase.from("admins").insert({ email });
    if (error) {
      setError("Impossible d'ajouter ce courriel (déjà admin ?).");
      return;
    }
    setNewEmail("");
    load();
  }

  async function handleRemove(id, email) {
    if (email === currentEmail) {
      setError("Tu ne peux pas te retirer toi-même.");
      return;
    }
    await supabase.from("admins").delete().eq("id", id);
    load();
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  return (
    <div>
      <h2>Équipe admin</h2>
      <p className="panel-hint">Les courriels qui ont accès à ce panneau.</p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Courriel</th>
              <th>Depuis</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>{a.email}</td>
                <td style={{ color: "var(--text-dim)" }}>
                  {new Date(a.created_at).toLocaleDateString("fr-CA")}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="admin-remove-btn" onClick={() => handleRemove(a.id, a.email)}>
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="admin-add-form" onSubmit={handleAdd}>
        <input
          type="email"
          placeholder="courriel@exemple.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
        />
        <button type="submit" className="btn-small">
          Ajouter
        </button>
      </form>
      {error && <p className="settings-msg err">{error}</p>}
    </div>
  );
}
