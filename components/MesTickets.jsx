"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";

const TXT = {
  fr: {
    chargement: "Chargement...",
    connexion: "Connecte-toi à ton compte Gozly pour ouvrir un ticket et suivre tes demandes.",
    seConnecter: "Se connecter",
    titre: "Mes tickets",
    nouveau: "Nouveau ticket",
    aucun: "Tu n'as pas encore de ticket.",
    ouvert: "Ouvert",
    ferme: "Fermé",
    reponse: "Réponse de l'équipe",
    sujet: "Sujet",
    sujetPh: "En une phrase : quel est ton problème ou ta question ?",
    message: "Message",
    messagePh: "Explique-nous le plus clairement possible ce qui se passe. Ajoute les étapes pour reproduire le problème si tu peux.",
    envoyer: "Envoyer",
    envoi: "Envoi...",
    annuler: "Annuler",
    retour: "Retour à mes tickets",
    toi: "Toi",
    equipe: "Équipe Gozly",
    repondre: "Écris ta réponse...",
    fermer: "Fermer ce ticket",
    confirmerFermer: "Fermer ce ticket ? Tu pourras toujours en ouvrir un nouveau.",
    estFerme: "Ce ticket est fermé. Si tu as encore besoin d'aide, ouvre un nouveau ticket.",
    erreur: "Quelque chose n'a pas fonctionné",
    note: "L'équipe répond ici, sur cette page. Reviens la consulter pour voir les réponses.",
    aideLien: "Avant d'ouvrir un ticket, jette un œil au centre d'aide : la réponse s'y trouve peut-être.",
  },
  en: {
    chargement: "Loading...",
    connexion: "Log in to your Gozly account to open a ticket and follow your requests.",
    seConnecter: "Log in",
    titre: "My tickets",
    nouveau: "New ticket",
    aucun: "You don't have any tickets yet.",
    ouvert: "Open",
    ferme: "Closed",
    reponse: "Reply from the team",
    sujet: "Subject",
    sujetPh: "In one sentence: what's your problem or question?",
    message: "Message",
    messagePh: "Tell us as clearly as you can what's going on. Add the steps to reproduce the problem if you can.",
    envoyer: "Send",
    envoi: "Sending...",
    annuler: "Cancel",
    retour: "Back to my tickets",
    toi: "You",
    equipe: "Gozly team",
    repondre: "Write your reply...",
    fermer: "Close this ticket",
    confirmerFermer: "Close this ticket? You can always open a new one.",
    estFerme: "This ticket is closed. If you still need help, open a new ticket.",
    erreur: "Something didn't work",
    note: "The team replies here, on this page. Come back to check for answers.",
    aideLien: "Before opening a ticket, have a look at the help center: the answer may be there.",
  },
};

function formatDate(iso, lang) {
  return new Date(iso).toLocaleString(lang === "en" ? "en-CA" : "fr-CA", { dateStyle: "medium", timeStyle: "short" });
}

export default function MesTickets() {
  const { lang } = useT();
  const T = TXT[lang] || TXT.fr;
  const tokenRef = useRef(null);
  const finConv = useRef(null);
  const [etape, setEtape] = useState("chargement"); // chargement | connexion | liste | nouveau | ticket
  const [tickets, setTickets] = useState([]);
  const [ouvert, setOuvert] = useState(null); // { ticket, messages }
  const [sujet, setSujet] = useState("");
  const [texte, setTexte] = useState("");
  const [reponse, setReponse] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");

  const jeton = useCallback(async () => {
    const s = await Promise.race([
      supabase.auth.getSession().then(({ data: { session } }) => session),
      new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    if (s?.access_token) tokenRef.current = s.access_token;
    return s?.access_token || tokenRef.current;
  }, []);

  const appeler = useCallback(
    async (chemin, options = {}) => {
      const token = await jeton();
      const res = await fetch(`/api/tickets${chemin}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
      return json;
    },
    [jeton]
  );

  const chargerListe = useCallback(async () => {
    const json = await appeler("");
    setTickets(json.tickets || []);
  }, [appeler]);

  const chargerTicket = useCallback(
    async (id) => {
      const json = await appeler(`?id=${id}`);
      setOuvert({ ticket: json.ticket, messages: json.messages || [] });
    },
    [appeler]
  );

  useEffect(() => {
    (async () => {
      const token = await jeton();
      if (!token) return setEtape("connexion");
      try {
        await chargerListe();
        setEtape("liste");
      } catch (e) {
        setErreur(e.message);
        setEtape("liste");
      }
    })();
  }, [jeton, chargerListe]);

  // Pendant qu'un ticket est ouvert, on le rafraîchit pour voir les réponses de l'équipe.
  useEffect(() => {
    if (etape !== "ticket" || !ouvert?.ticket?.id) return;
    const id = setInterval(() => chargerTicket(ouvert.ticket.id).catch(() => {}), 10000);
    return () => clearInterval(id);
  }, [etape, ouvert?.ticket?.id, chargerTicket]);

  useEffect(() => {
    if (etape === "ticket" && finConv.current) finConv.current.scrollIntoView({ block: "nearest" });
  }, [etape, ouvert?.messages?.length]);

  async function ouvrirTicket(t) {
    setErreur("");
    setReponse("");
    try {
      await chargerTicket(t.id);
      setEtape("ticket");
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function creer(e) {
    e.preventDefault();
    setOccupe(true);
    setErreur("");
    try {
      const json = await appeler("", { method: "POST", body: JSON.stringify({ sujet, texte }) });
      setSujet("");
      setTexte("");
      await chargerListe();
      await chargerTicket(json.id);
      setEtape("ticket");
    } catch (err) {
      setErreur(err.message);
    } finally {
      setOccupe(false);
    }
  }

  async function repondre(e) {
    e.preventDefault();
    if (!reponse.trim()) return;
    setOccupe(true);
    setErreur("");
    try {
      await appeler("", { method: "POST", body: JSON.stringify({ action: "repondre", id: ouvert.ticket.id, texte: reponse }) });
      setReponse("");
      await chargerTicket(ouvert.ticket.id);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setOccupe(false);
    }
  }

  async function fermer() {
    if (!window.confirm(T.confirmerFermer)) return;
    setOccupe(true);
    try {
      await appeler("", { method: "POST", body: JSON.stringify({ action: "fermer", id: ouvert.ticket.id }) });
      await chargerTicket(ouvert.ticket.id);
      await chargerListe();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setOccupe(false);
    }
  }

  const retourListe = async () => {
    setEtape("liste");
    setErreur("");
    try {
      await chargerListe();
    } catch {}
  };

  return (
    <div className="aide-wrap" style={{ maxWidth: "720px" }}>
      {etape === "chargement" && <p style={{ textAlign: "center", color: "var(--text-dim)" }}>{T.chargement}</p>}

      {etape === "connexion" && (
        <div className="aide-carte" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: "18px" }}>{T.connexion}</p>
          <Link href={`/login?retour=${encodeURIComponent("/aide/tickets")}`} className="submit-btn" style={{ display: "inline-block", textDecoration: "none" }}>
            {T.seConnecter}
          </Link>
        </div>
      )}

      {etape === "liste" && (
        <div className="aide-carte">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
            <h2 style={{ margin: 0 }}>{T.titre}</h2>
            <button type="button" className="btn-small" onClick={() => { setErreur(""); setEtape("nouveau"); }}>
              {T.nouveau}
            </button>
          </div>
          <p className="aide-note">
            {T.aideLien} <Link href="/aide">→</Link>
          </p>
          {erreur && <p className="settings-msg err">{erreur}</p>}
          {tickets.length === 0 && !erreur && <p style={{ color: "var(--text-dim)", padding: "10px 0" }}>{T.aucun}</p>}
          {tickets.map((t) => (
            <button key={t.id} type="button" className="mes-ticket" onClick={() => ouvrirTicket(t)}>
              <span className="mes-ticket-sujet">{t.sujet}</span>
              <span className="mes-ticket-meta">
                {formatDate(t.maj, lang)}
                <span className={`admin-status-pill ${t.statut === "ouvert" ? "active" : "inactive"}`}>{t.statut === "ouvert" ? T.ouvert : T.ferme}</span>
                {t.statut === "ouvert" && t.dernier_auteur === "equipe" && <span className="mes-ticket-reponse">{T.reponse}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {etape === "nouveau" && (
        <form className="aide-carte" onSubmit={creer} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h2 style={{ margin: 0 }}>{T.nouveau}</h2>
          <p className="aide-note">{T.note}</p>
          <input type="text" value={sujet} maxLength={120} onChange={(e) => setSujet(e.target.value)} placeholder={T.sujetPh} aria-label={T.sujet} />
          <textarea value={texte} maxLength={2000} rows={7} onChange={(e) => setTexte(e.target.value)} placeholder={T.messagePh} aria-label={T.message} />
          {erreur && <p className="settings-msg err" style={{ margin: 0 }}>{erreur}</p>}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button type="submit" className="btn-small" disabled={occupe || !sujet.trim() || !texte.trim()}>
              {occupe ? T.envoi : T.envoyer}
            </button>
            <button type="button" className="admin-icon-btn" onClick={retourListe}>
              {T.annuler}
            </button>
          </div>
        </form>
      )}

      {etape === "ticket" && ouvert && (
        <div className="aide-carte">
          <button type="button" className="admin-icon-btn" onClick={retourListe} style={{ marginBottom: "14px" }}>
            ← {T.retour}
          </button>
          <h2 style={{ margin: "0 0 4px" }}>{ouvert.ticket.sujet}</h2>
          <div className="admin-row-sub" style={{ marginBottom: "16px" }}>
            {formatDate(ouvert.ticket.created_at, lang)} · {ouvert.ticket.statut === "ouvert" ? T.ouvert : T.ferme}
          </div>

          <div className="mes-conv">
            {ouvert.messages.map((m) => (
              <div key={m.id} className={`ticket-msg${m.auteur === "equipe" ? " bot" : ""}`}>
                <div className="ticket-msg-tete">
                  <strong>{m.auteur === "equipe" ? T.equipe : T.toi}</strong>
                  <span>{formatDate(m.created_at, lang)}</span>
                </div>
                <p>{m.texte}</p>
              </div>
            ))}
            <div ref={finConv} />
          </div>

          {ouvert.ticket.statut === "ouvert" ? (
            <form className="ticket-reponse" onSubmit={repondre}>
              <textarea value={reponse} rows={3} maxLength={2000} onChange={(e) => setReponse(e.target.value)} placeholder={T.repondre} />
              {erreur && <p className="settings-msg err" style={{ margin: 0 }}>{erreur}</p>}
              <div className="ticket-reponse-pied">
                <button type="button" className="admin-icon-btn danger" onClick={fermer} disabled={occupe}>
                  {T.fermer}
                </button>
                <button type="submit" className="btn-small" disabled={occupe || !reponse.trim()}>
                  {occupe ? T.envoi : T.envoyer}
                </button>
              </div>
            </form>
          ) : (
            <p className="aide-note" style={{ marginTop: "14px" }}>{T.estFerme}</p>
          )}
        </div>
      )}
    </div>
  );
}
