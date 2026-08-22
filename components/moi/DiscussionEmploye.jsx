"use client";

import { useEffect, useRef, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";

export default function DiscussionEmploye() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeTitre, setActiveTitre] = useState("");
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [collegues, setCollegues] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [vue, setVue] = useState("liste"); // "liste" | "thread"
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    chargerConversations();
    employeFetch("/api/employe-app/chat/collegues").then(async (res) => {
      const data = await res.json();
      setCollegues(data.collegues || []);
    });
  }, []);

  useEffect(() => {
    if (!activeId) return;
    chargerMessages(activeId);
    pollRef.current = setInterval(() => chargerMessages(activeId), 4000);
    return () => clearInterval(pollRef.current);
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function chargerConversations() {
    setLoading(true);
    setErreur(null);
    try {
      const res = await employeFetch("/api/employe-app/chat/conversations");
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error || "Le chargement des conversations a échoué.");
      } else {
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error("Erreur chargement conversations:", err);
      setErreur("Le chargement des conversations a échoué.");
    }
    setLoading(false);
  }

  async function chargerMessages(conversationId) {
    const res = await employeFetch(`/api/employe-app/chat/messages?conversationId=${conversationId}`);
    const data = await res.json();
    setMessages(data.messages || []);
  }

  function ouvrirConversation(c) {
    setActiveId(c.id);
    setActiveTitre(c.titre);
    setVue("thread");
  }

  async function handleEnvoyer(e) {
    e.preventDefault();
    if (!texte.trim() || !activeId) return;
    const contenu = texte.trim();
    setTexte("");

    await employeFetch("/api/employe-app/chat/messages", {
      method: "POST",
      body: JSON.stringify({ conversationId: activeId, contenu }),
    });
    chargerMessages(activeId);
    chargerConversations();
  }

  async function demarrerConversation(collegueId, nom) {
    setPickerOpen(false);
    setErreur(null);
    try {
      const res = await employeFetch("/api/employe-app/chat/conversations/directe", {
        method: "POST",
        body: JSON.stringify({ avecEmployeId: collegueId }),
      });
      const data = await res.json();
      if (!res.ok || !data.conversationId) {
        setErreur(data.error || "Impossible de démarrer cette conversation.");
        return;
      }
      await chargerConversations();
      setActiveId(data.conversationId);
      setActiveTitre(nom);
      setVue("thread");
    } catch (err) {
      console.error("Erreur création conversation:", err);
      setErreur("Impossible de démarrer cette conversation.");
    }
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  if (erreur && conversations.length === 0) {
    return <p className="settings-msg err">{erreur}</p>;
  }

  return (
    <div className="moi-discussion">
      {erreur && <p className="settings-msg err" style={{ margin: "0 0 10px" }}>{erreur}</p>}
      <div className="chat-layout">
        <div className={`chat-conv-list${vue === "thread" ? " hidden-mobile" : ""}`}>
          <div className="chat-conv-list-head">
            <strong style={{ fontSize: "13px" }}>Discussion</strong>
            <button type="button" className="admin-icon-btn" onClick={() => setPickerOpen((v) => !v)}>
              + Nouveau
            </button>
          </div>
          {pickerOpen && (
            <div className="chat-picker">
              <div className="chat-section-label">Démarrer avec...</div>
              {collegues.length === 0 ? (
                <p className="chat-empty">Aucun collègue pour l'instant.</p>
              ) : (
                collegues.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="chat-conv-item"
                    onClick={() => demarrerConversation(c.id, c.nom)}
                  >
                    {c.nom}
                  </button>
                ))
              )}
            </div>
          )}
          <div className="chat-section-label">Conversations</div>
          {conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chat-conv-item${activeId === c.id ? " active" : ""}`}
              onClick={() => ouvrirConversation(c)}
            >
              <div className="chat-conv-titre">
                {c.type === "equipe" ? "👥 " : ""}
                {c.titre}
              </div>
              {c.dernierMessage && <div className="chat-conv-apercu">{c.dernierMessage}</div>}
            </button>
          ))}
        </div>

        {vue === "thread" && (
          <div className="chat-thread">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <button type="button" className="admin-icon-btn" onClick={() => setVue("liste")}>
                ‹
              </button>
              <strong style={{ fontSize: "14px" }}>{activeTitre}</strong>
            </div>
            <div className="chat-messages">
              {messages.length === 0 && <p className="chat-empty">Aucun message pour l'instant.</p>}
              {messages.map((m) => (
                <div key={m.id} className={`chat-bubble-row${m.deMoi ? " mine" : ""}`}>
                  <div className="chat-bubble-auteur">{m.deMoi ? "Toi" : m.expediteurNom}</div>
                  <div className="chat-bubble">{m.contenu}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-compose" onSubmit={handleEnvoyer}>
              <input type="text" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Écrire un message..." />
              <button type="submit" className="chat-send-btn" disabled={!texte.trim()} aria-label="Envoyer">
                ➤
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
