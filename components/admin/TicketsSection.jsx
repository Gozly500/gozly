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
  const [etat, setEtat] = useState({ chargement: true, configure: true, tickets: [], erreur: "", diagnostic: null });
  const [filtre, setFiltre] = useState("ouverts");
  const [ouvert, setOuvert] = useState(null); // id du ticket affiché
  const [conv, setConv] = useState({ chargement: false, messages: [], erreur: "" });
  const [reponse, setReponse] = useState("");
  const [mentionner, setMentionner] = useState(true);
  const [envoiRep, setEnvoiRep] = useState({ occupe: false, message: "" });
  const finConv = useRef(null);

  const charger = useCallback(async () => {
    const token = await jeton(tokenRef);
    if (!token) return setEtat((e) => ({ ...e, chargement: false, erreur: "Session introuvable : reconnecte-toi." }));
    try {
      const res = await fetch("/api/admin/tickets", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setEtat({ chargement: false, configure: json.configure !== false, tickets: json.tickets || [], erreur: "", diagnostic: json.diagnostic || null });
    } catch (e) {
      setEtat((s) => ({ ...s, chargement: false, erreur: e.message }));
    }
  }, []);

  useEffect(() => {
    charger();
    const id = setInterval(charger, 30000);
    return () => clearInterval(id);
  }, [charger]);

  // silencieux = rafraîchissement automatique (on garde l'affichage actuel en cas d'échec).
  const chargerConv = useCallback(async (id, silencieux) => {
    if (!silencieux) setConv({ chargement: true, messages: [], erreur: "" });
    const token = await jeton(tokenRef);
    try {
      const res = await fetch(`/api/admin/tickets?id=${id}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setConv({ chargement: false, messages: json.messages || [], erreur: "" });
    } catch (e) {
      if (!silencieux) setConv({ chargement: false, messages: [], erreur: e.message });
    }
  }, []);

  function voir(ticket) {
    if (ouvert === ticket.id) return setOuvert(null);
    setOuvert(ticket.id);
    setReponse("");
    setEnvoiRep({ occupe: false, message: "" });
    chargerConv(ticket.id, false);
  }

  // Pendant qu'une conversation est ouverte, on la rafraîchit pour voir les réponses de la personne.
  useEffect(() => {
    if (!ouvert) return;
    const id = setInterval(() => chargerConv(ouvert, true), 8000);
    return () => clearInterval(id);
  }, [ouvert, chargerConv]);

  // Descend en bas de la conversation quand de nouveaux messages arrivent.
  useEffect(() => {
    if (finConv.current) finConv.current.scrollIntoView({ block: "nearest" });
  }, [conv.messages.length, ouvert]);

  async function repondre(e, ticket) {
    e.preventDefault();
    if (!reponse.trim()) return;
    setEnvoiRep({ occupe: true, message: "" });
    try {
      const token = await jeton(tokenRef);
      const res = await fetch("/api/admin/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: ticket.id, texte: reponse, mentionner }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      setReponse("");
      setEnvoiRep({ occupe: false, message: "" });
      chargerConv(ticket.id, true);
    } catch (err) {
      setEnvoiRep({ occupe: false, message: err.message });
    }
  }

  if (etat.chargement) return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;

  const liste = etat.tickets.filter((t) => (filtre === "ouverts" ? !t.ferme : filtre === "fermes" ? t.ferme : true));
  const nbOuverts = etat.tickets.filter((t) => !t.ferme).length;

  return (
    <div>
      <h2>Tickets</h2>
      <p className="panel-hint">
        Les tickets ouverts dans le Discord de Gozly ({nbOuverts} ouvert{nbOuverts > 1 ? "s" : ""}). Tu peux répondre ici : c'est Gozyx qui envoie ton message dans le salon du ticket.
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
                    <div ref={finConv} />

                    {t.ferme ? (
                      <p className="ticket-conv-vide">Ticket fermé : la personne ne peut plus écrire. Rouvre-le dans Discord pour continuer la conversation.</p>
                    ) : (
                      <form className="ticket-reponse" onSubmit={(e) => repondre(e, t)}>
                        <textarea
                          value={reponse}
                          rows={3}
                          maxLength={1800}
                          onChange={(e) => setReponse(e.target.value)}
                          placeholder="Écris ta réponse (envoyée par Gozyx dans le ticket)..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) repondre(e, t);
                          }}
                        />
                        <div className="ticket-reponse-pied">
                          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", color: "var(--text-dim)" }}>
                            <span className="switch">
                              <input type="checkbox" checked={mentionner} onChange={(e) => setMentionner(e.target.checked)} />
                              <span className="switch-track"></span>
                              <span className="switch-thumb"></span>
                            </span>
                            Notifier {t.proprietaire}
                          </label>
                          <button type="submit" className="btn-small" disabled={envoiRep.occupe || !reponse.trim()}>
                            {envoiRep.occupe ? "Envoi..." : "Répondre"}
                          </button>
                        </div>
                        {envoiRep.message && <p className="settings-msg err" style={{ margin: 0 }}>{envoiRep.message}</p>}
                      </form>
                    )}
                  </div>
                )}
              </div>
            ))}
            {liste.length === 0 && !etat.erreur && (
              <div className="admin-empty">
                Aucun ticket{filtre !== "tous" && etat.tickets.length > 0 ? " dans ce filtre : essaie « Tous »" : ""}.
                {etat.diagnostic && etat.tickets.length === 0 && (
                  <p style={{ marginTop: "10px", fontSize: "12.5px" }}>
                    Le bot voit {etat.diagnostic.salons} salon(s) sur le serveur, dont {etat.diagnostic.salonsTexte} textuel(s) et {etat.diagnostic.avecSujetTicket} reconnu(s) comme ticket.
                    {etat.diagnostic.nomsTicket.length > 0 && <> Salons nommés ticket-/ferme- : {etat.diagnostic.nomsTicket.join(", ")}.</>}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
