"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getOrCreateEquipeConversation, getOrCreateDirecteConversation } from "@/lib/chatServer";

export default function DiscussionSection({ entrepriseId, userId }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [employes, setEmployes] = useState([]);
  const [employeIdsEnDiscussion, setEmployeIdsEnDiscussion] = useState(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    chargerConversations();
    supabase
      .from("employes")
      .select("id, nom")
      .eq("entreprise_id", entrepriseId)
      .order("nom", { ascending: true })
      .then(({ data }) => setEmployes(data || []));
  }, [entrepriseId]);

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
      await chargerConversationsImpl();
    } catch (err) {
      console.error("Erreur chargement conversations:", err);
      setErreur(err?.message || "Le chargement des conversations a échoué.");
    }
    setLoading(false);
  }

  async function chargerConversationsImpl() {
    const equipeId = await getOrCreateEquipeConversation(supabase, entrepriseId);

    const { data: mesParticipations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId);

    const directeIds = (mesParticipations || []).map((p) => p.conversation_id);
    const conversationIds = [equipeId, ...directeIds];

    const { data: dernierMessages } = await supabase
      .from("messages")
      .select("conversation_id, contenu, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    const dernierPar = {};
    for (const m of dernierMessages || []) {
      if (!dernierPar[m.conversation_id]) dernierPar[m.conversation_id] = m;
    }

    let autresParticipants = [];
    if (directeIds.length > 0) {
      const { data } = await supabase
        .from("conversation_participants")
        .select("conversation_id, employe_id, user_id")
        .in("conversation_id", directeIds);
      autresParticipants = (data || []).filter((p) => p.user_id !== userId);
    }

    const employeIds = autresParticipants.filter((p) => p.employe_id).map((p) => p.employe_id);
    const userIds = autresParticipants.filter((p) => p.user_id).map((p) => p.user_id);
    setEmployeIdsEnDiscussion(new Set(employeIds));

    const [{ data: employesAutres }, { data: profilsAutres }] = await Promise.all([
      employeIds.length > 0 ? supabase.from("employes").select("id, nom").in("id", employeIds) : Promise.resolve({ data: [] }),
      userIds.length > 0 ? supabase.from("profils").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] }),
    ]);

    function nomAutre(conversationId) {
      const p = autresParticipants.find((a) => a.conversation_id === conversationId);
      if (!p) return "Conversation";
      if (p.employe_id) return employesAutres?.find((e) => e.id === p.employe_id)?.nom || "Employé";
      return profilsAutres?.find((pr) => pr.id === p.user_id)?.full_name || "Administration";
    }

    const liste = [
      {
        id: equipeId,
        type: "equipe",
        titre: "Équipe",
        dernierMessage: dernierPar[equipeId]?.contenu || null,
        dernierMessageDate: dernierPar[equipeId]?.created_at || null,
      },
      ...directeIds.map((id) => ({
        id,
        type: "directe",
        titre: nomAutre(id),
        dernierMessage: dernierPar[id]?.contenu || null,
        dernierMessageDate: dernierPar[id]?.created_at || null,
      })),
    ].sort((a, b) => new Date(b.dernierMessageDate || 0) - new Date(a.dernierMessageDate || 0));

    setConversations(liste);
    setActiveId((cur) => cur || equipeId);
  }

  async function chargerMessages(conversationId) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(data || []);
  }

  async function handleEnvoyer(e) {
    e.preventDefault();
    if (!texte.trim() || !activeId) return;
    const contenu = texte.trim();
    setTexte("");

    await supabase.from("messages").insert({ conversation_id: activeId, user_id: userId, contenu });
    chargerMessages(activeId);
    chargerConversations();
  }

  async function ouvrirConversationAvec(employeId) {
    setPickerOpen(false);
    setErreur(null);
    let conversationId;
    try {
      conversationId = await getOrCreateDirecteConversation(supabase, entrepriseId, { userId }, { employeId });
    } catch (err) {
      console.error("Erreur création conversation:", err);
      setErreur(err?.message || "Impossible de démarrer cette conversation.");
      return;
    }
    await chargerConversations();
    setActiveId(conversationId);
  }

  function nomExpediteur(m) {
    if (m.user_id === userId) return "Toi";
    if (m.employe_id) return conversationActive?.type === "equipe" ? employes.find((e) => e.id === m.employe_id)?.nom || "Employé" : conversationActive?.titre;
    return conversationActive?.type === "equipe" ? "Administration" : conversationActive?.titre;
  }

  const conversationActive = conversations.find((c) => c.id === activeId);

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  if (erreur && conversations.length === 0) {
    return <p className="settings-msg err">{erreur}</p>;
  }

  return (
    <div>
      <h2>Discussion</h2>
      <p className="panel-hint">Le fil d'équipe et tes conversations privées avec les employés.</p>
      {erreur && <p className="settings-msg err">{erreur}</p>}

      <div className="chat-layout">
        <div className="chat-conv-list">
          <div className="chat-conv-list-head">
            <strong style={{ fontSize: "13px" }}>Conversations</strong>
            <button type="button" className="admin-icon-btn" onClick={() => setPickerOpen((v) => !v)}>
              + Nouveau
            </button>
          </div>
          {pickerOpen && (
            <div className="chat-picker">
              <div className="chat-section-label">Démarrer avec...</div>
              {employes.filter((e) => !employeIdsEnDiscussion.has(e.id)).length === 0 ? (
                <p className="chat-empty">Tu discutes déjà avec tout le monde.</p>
              ) : (
                employes
                  .filter((e) => !employeIdsEnDiscussion.has(e.id))
                  .map((e) => (
                    <button key={e.id} type="button" className="chat-conv-item" onClick={() => ouvrirConversationAvec(e.id)}>
                      {e.nom}
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
              onClick={() => setActiveId(c.id)}
            >
              <div className="chat-conv-titre">{c.type === "equipe" ? "👥 " : ""}{c.titre}</div>
              {c.dernierMessage && <div className="chat-conv-apercu">{c.dernierMessage}</div>}
            </button>
          ))}
        </div>

        <div className="chat-thread">
          {!activeId ? (
            <p className="chat-empty">Sélectionne une conversation.</p>
          ) : (
            <>
              <div className="chat-messages">
                {messages.length === 0 && <p className="chat-empty">Aucun message pour l'instant.</p>}
                {messages.map((m) => (
                  <div key={m.id} className={`chat-bubble-row${m.user_id === userId ? " mine" : ""}`}>
                    <div className="chat-bubble-auteur">{nomExpediteur(m)}</div>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
