"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const DUREES = [
  { id: 0, label: "Sans limite" },
  { id: 24, label: "24 heures" },
  { id: 72, label: "3 jours" },
  { id: 168, label: "7 jours" },
];

async function jeton(ref) {
  // getSession peut rester bloqué (verrou d'auth) : on retombe sur le dernier jeton connu.
  const token = await Promise.race([
    supabase.auth.getSession().then(({ data: { session } }) => session?.access_token || null),
    new Promise((resolve) => setTimeout(() => resolve(ref.current), 3000)),
  ]);
  if (token) ref.current = token;
  return token;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });
}

export default function VotesSection() {
  const tokenRef = useRef(null);
  const [etat, setEtat] = useState({ chargement: true, votes: [], erreur: "" });
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [duree, setDuree] = useState(0);
  const [reserve, setReserve] = useState(false);
  const [envoi, setEnvoi] = useState({ occupe: false, message: "", ok: false });

  const charger = useCallback(async () => {
    const token = await jeton(tokenRef);
    if (!token) return setEtat((e) => ({ ...e, chargement: false, erreur: "Session introuvable : reconnecte-toi." }));
    try {
      const res = await fetch("/api/admin/votes", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setEtat({ chargement: false, votes: json.votes || [], erreur: "" });
    } catch (e) {
      setEtat((s) => ({ ...s, chargement: false, erreur: e.message }));
    }
  }, []);

  useEffect(() => {
    charger();
    const id = setInterval(charger, 30000);
    return () => clearInterval(id);
  }, [charger]);

  async function appeler(corps) {
    const token = await jeton(tokenRef);
    const res = await fetch("/api/admin/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(corps),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
    return json;
  }

  async function publier(e) {
    e.preventDefault();
    if (!titre.trim()) return setEnvoi({ occupe: false, ok: false, message: "Écris le sujet du vote." });
    setEnvoi({ occupe: true, ok: false, message: "" });
    try {
      await appeler({ titre, description, dureeHeures: duree, reserve });
      setEnvoi({ occupe: false, ok: true, message: "Vote publié dans Discord." });
      setTitre("");
      setDescription("");
      setDuree(0);
      setReserve(false);
      charger();
    } catch (err) {
      setEnvoi({ occupe: false, ok: false, message: err.message });
    }
  }

  async function cloturer(v) {
    if (!window.confirm(`Terminer le vote « ${v.titre} » ? Les boutons seront retirés dans Discord.`)) return;
    try {
      await appeler({ action: "cloturer", id: v.id });
      charger();
    } catch (err) {
      setEtat((s) => ({ ...s, erreur: err.message }));
    }
  }

  return (
    <div>
      <h2>Votes</h2>
      <p className="panel-hint">
        Publie un référendum dans le salon « référendums » de Discord : Gozlyx affiche les boutons Pour / Contre et met les résultats à jour en direct.
      </p>

      <form onSubmit={publier} style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "620px", marginBottom: "34px" }}>
        <input type="text" value={titre} maxLength={200} onChange={(e) => setTitre(e.target.value)} placeholder="Sujet du vote (ex : Ajouter un mode clair au tableau de bord ?)" />
        <textarea value={description} maxLength={1500} rows={4} onChange={(e) => setDescription(e.target.value)} placeholder="Explications (facultatif)" />

        <div>
          <div className="admin-row-sub" style={{ marginBottom: "6px" }}>
            Durée
          </div>
          <div className="settings-nav" style={{ flexDirection: "row", width: "fit-content" }}>
            {DUREES.map((d) => (
              <button key={d.id} type="button" className={`settings-nav-item${duree === d.id ? " active" : ""}`} style={{ whiteSpace: "nowrap" }} onClick={() => setDuree(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
          <span className="switch">
            <input type="checkbox" checked={reserve} onChange={(e) => setReserve(e.target.checked)} />
            <span className="switch-track"></span>
            <span className="switch-thumb"></span>
          </span>
          <span>Réservé aux membres avec le rôle « Compte lié »</span>
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
          <button type="submit" className="btn-small" disabled={envoi.occupe}>
            {envoi.occupe ? "Publication..." : "Publier dans Discord"}
          </button>
          {envoi.message && <span className={`settings-msg ${envoi.ok ? "ok" : "err"}`} style={{ margin: 0 }}>{envoi.message}</span>}
        </div>
      </form>

      {etat.erreur && <div className="admin-empty">Erreur : {etat.erreur}</div>}
      {etat.chargement && <p style={{ color: "var(--text-dim)" }}>Chargement...</p>}

      <div className="admin-list" style={{ maxWidth: "820px" }}>
        {etat.votes.map((v) => {
          const total = v.pour + v.contre;
          const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
          return (
            <div className="admin-row" key={v.id} style={{ alignItems: "center" }}>
              <div className="admin-row-main" style={{ flex: 1 }}>
                <div className="admin-row-title">{v.titre}</div>
                <div className="admin-row-sub">
                  Publié le {formatDate(v.creeLe)}
                  {v.finLe && !v.ferme ? ` · fin ${formatDate(v.finLe)}` : ""}
                  {v.reserve ? " · comptes liés seulement" : ""}
                </div>
                <div className="vote-barre" title={`${v.pour} pour, ${v.contre} contre`}>
                  <span className="vote-pour" style={{ width: `${pct(v.pour)}%` }} />
                  <span className="vote-contre" style={{ width: `${total ? 100 - pct(v.pour) : 0}%` }} />
                </div>
                <div className="admin-row-sub">
                  👍 {v.pour} ({pct(v.pour)} %) · 👎 {v.contre} ({total ? 100 - pct(v.pour) : 0} %) · {total} vote{total > 1 ? "s" : ""}
                </div>
              </div>
              <div className="admin-row-controls">
                <span className={`admin-status-pill ${v.ferme ? "inactive" : "active"}`}>{v.ferme ? "Terminé" : "En cours"}</span>
                {!v.ferme && (
                  <button type="button" className="admin-icon-btn danger" onClick={() => cloturer(v)}>
                    Terminer
                  </button>
                )}
                <a className="admin-icon-btn" href={v.url} target="_blank" rel="noopener noreferrer">
                  Ouvrir dans Discord
                </a>
              </div>
            </div>
          );
        })}
        {!etat.chargement && etat.votes.length === 0 && !etat.erreur && <div className="admin-empty">Aucun vote pour l'instant.</div>}
      </div>
    </div>
  );
}
