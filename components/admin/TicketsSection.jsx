"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const FILTRES = [
  { id: "ouverts", label: "Ouverts" },
  { id: "tous", label: "Tous" },
  { id: "fermes", label: "Fermés" },
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

export default function TicketsSection() {
  const tokenRef = useRef(null);
  const [etat, setEtat] = useState({ chargement: true, configure: true, tickets: [], erreur: "" });
  const [filtre, setFiltre] = useState("ouverts");
  const [ouvert, setOuvert] = useState(null); // id du ticket affiché
  const [conv, setConv] = useState({ chargement: false, messages: [], erreur: "" });

  const charger = useCallback(async () => {
    const token = await jeton(tokenRef);
    if (!token) return setEtat((e) => ({ ...e, chargement: false, erreur: "Session introuvable : reconnecte-toi." }));
    try {
      const res = await fetch("/api/admin/tickets", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setEtat({ chargement: false, configure: json.configure !== false, tickets: json.tickets || [], erreur: "" });
    } catch (e) {
      setEtat((s) => ({ ...s, chargement: false, erreur: e.message }));
    }
  }, []);

  useEffect(() => {
    charger();
    const id = setInterval(charger, 30000);
    return () => clearInterval(id);
  }, [charger]);

  async function voir(ticket) {
    if (ouvert === ticket.id) return setOuvert(null);
    setOuvert(ticket.id);
    setConv({ chargement: true, messages: [], erreur: "" });
    const token = await jeton(tokenRef);
    try {
      const res = await fetch(`/api/admin/tickets?id=${ticket.id}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setConv({ chargement: false, messages: json.messages || [], erreur: "" });
    } catch (e) {
      setConv({ chargement: false, messages: [], erreur: e.message });
    }
  }

  if (etat.chargement) return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;

  const liste = etat.tickets.filter((t) => (filtre === "ouverts" ? !t.ferme : filtre === "fermes" ? t.ferme : true));
  const nbOuverts = etat.tickets.filter((t) => !t.ferme).length;

  return (
    <div>
      <h2>Tickets</h2>
      <p className="panel-hint">
        Les tickets ouverts dans le Discord de Gozly ({nbOuverts} ouvert{nbOuverts > 1 ? "s" : ""}). Lecture seule : pour répondre, ouvre le salon dans Discord.
      </p>

      {!etat.configure && (
        <div className="admin-empty">
          Discord n'est pas encore relié : ajoute la variable <code>DISCORD_GUILD_ID</code> (identifiant du serveur) dans Vercel, puis redéploie.
        </div>
      )}
      {etat.erreur && <div className="admin-empty">Erreur : {etat.erreur}</div>}

      {etat.configure && (
        <>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "20px" }}>
            <div className="settings-nav" style={{ flexDirection: "row", width: "fit-content" }}>
              {FILTRES.map((f) => (
                <button key={f.id} type="button" className={`settings-nav-item${filtre === f.id ? " active" : ""}`} onClick={() => setFiltre(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <button type="button" className="admin-icon-btn" onClick={charger}>
              Actualiser
            </button>
          </div>

          <div className="admin-list" style={{ maxWidth: "820px" }}>
            {liste.map((t) => (
              <div key={t.id}>
                <div className="admin-row" style={{ alignItems: "center" }}>
                  <div className="admin-row-main">
                    <div className="admin-row-title">{t.proprietaire}</div>
                    <div className="admin-row-sub">Ouvert le {formatDate(t.ouvertLe)} · Discord</div>
                  </div>
                  <div className="admin-row-controls">
                    <span className={`admin-status-pill ${t.ferme ? "inactive" : "active"}`}>{t.ferme ? "Fermé" : "Ouvert"}</span>
                    <button type="button" className="admin-icon-btn" onClick={() => voir(t)}>
                      {ouvert === t.id ? "Masquer" : "Voir la conversation"}
                    </button>
                    <a className="admin-icon-btn" href={t.url} target="_blank" rel="noopener noreferrer">
                      Ouvrir dans Discord
                    </a>
                  </div>
                </div>
                {ouvert === t.id && (
                  <div className="ticket-conv">
                    {conv.chargement && <p className="ticket-conv-vide">Chargement...</p>}
                    {conv.erreur && <p className="ticket-conv-vide">Erreur : {conv.erreur}</p>}
                    {!conv.chargement && !conv.erreur && conv.messages.length === 0 && <p className="ticket-conv-vide">Aucun message.</p>}
                    {conv.messages.map((m) => (
                      <div key={m.id} className={`ticket-msg${m.bot ? " bot" : ""}`}>
                        <div className="ticket-msg-tete">
                          <strong>{m.auteur}</strong>
                          {m.bot && <span className="ticket-bot">BOT</span>}
                          <span>{formatDate(m.date)}</span>
                        </div>
                        {m.contenu && <p>{m.contenu}</p>}
                        {m.embeds.map((e, i) => (
                          <p key={i} className="ticket-embed">
                            {e}
                          </p>
                        ))}
                        {m.fichiers.map((f) => (
                          <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="ticket-fichier">
                            {f.nom}
                          </a>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {liste.length === 0 && !etat.erreur && <div className="admin-empty">Aucun ticket.</div>}
          </div>
        </>
      )}
    </div>
  );
}
