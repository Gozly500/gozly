"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getOrCreateEquipeConversation, getOrCreateDirecteConversation } from "@/lib/chatServer";

import { useChatPresence } from "@/lib/useChatPresence";
import { libelleVu, LigneVu, IndicateurEcriture } from "@/components/chat/IndicateursChat";
import BulleMessage, { appliquerReactionLocale } from "@/components/chat/BulleMessage";

// mobile : une seule colonne à la fois (liste des conversations OU conversation ouverte), pour l'app /gestion.
export default function DiscussionSection({ entrepriseId, userId, mobile = false }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [vueMobile, setVueMobile] = useState("liste"); // "liste" | "thread" (mobile seulement)
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [employes, setEmployes] = useState([]);
  const [employeIdsEnDiscussion, setEmployeIdsEnDiscussion] = useState(new Set());
  const [recherche, setRecherche] = useState("");
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [groupeModal, setGroupeModal] = useState(null); // { nom, ids: Set d'employés } quand la fenêtre de création est ouverte
  const [groupeBusy, setGroupeBusy] = useState(false);
  const [menuNouveauOuvert, setMenuNouveauOuvert] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const messagesEndRef = useRef(null);
  const dernierMessageIdRef = useRef(null);
  const [reactions, setReactions] = useState({}); // { [messageId]: [{ emoji, nom, mine }] }
  const [messageOuvertId, setMessageOuvertId] = useState(null);
  const [repondreA, setRepondreA] = useState(null); // { id, auteur, contenu }
  const presence = useChatPresence(activeId, async (corps) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/chat/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(corps),
    });
    return res.ok ? res.json() : null;
  });
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

  // On descend seulement quand le dernier message change (nouveau message ou
  // conversation ouverte), pas à chaque rechargement automatique.
  useEffect(() => {
    const dernierId = messages[messages.length - 1]?.id ?? null;
    if (dernierId !== dernierMessageIdRef.current) {
      dernierMessageIdRef.current = dernierId;
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages]);

  useEffect(() => {
    dernierMessageIdRef.current = null;
  }, [activeId]);

  async function chargerConversations({ silencieux = false } = {}) {
    if (!silencieux) setLoading(true);
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

    const privesIds = (mesParticipations || []).map((p) => p.conversation_id);
    const conversationIds = [equipeId, ...privesIds];

    // Type (directe / groupe) et nom des conversations privées.
    const { data: infos } =
      privesIds.length > 0
        ? await supabase.from("conversations").select("id, type, titre").in("id", privesIds)
        : { data: [] };
    const infoPar = Object.fromEntries((infos || []).map((c) => [c.id, c]));
    const directeIds = privesIds.filter((id) => infoPar[id]?.type === "directe");
    const groupeIds = privesIds.filter((id) => infoPar[id]?.type === "groupe");

    const { data: dernierMessages } = await supabase
      .from("messages")
      .select("conversation_id, contenu, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    const dernierPar = {};
    for (const m of dernierMessages || []) {
      if (!dernierPar[m.conversation_id]) dernierPar[m.conversation_id] = m;
    }

    // Tous les participants des conversations privées (sans .neq : voir la note
    // sur NULL dans la mémoire du projet) ; "moi" est exclu en JS.
    let autresParticipants = [];
    if (privesIds.length > 0) {
      const { data } = await supabase
        .from("conversation_participants")
        .select("conversation_id, employe_id, user_id")
        .in("conversation_id", privesIds);
      autresParticipants = (data || []).filter((p) => p.user_id !== userId);
    }

    const employeIds = autresParticipants.filter((p) => p.employe_id).map((p) => p.employe_id);
    const userIds = autresParticipants.filter((p) => p.user_id).map((p) => p.user_id);
    // Pour le sélecteur "Démarrer avec..." : seulement les conversations 1 à 1.
    setEmployeIdsEnDiscussion(
      new Set(autresParticipants.filter((p) => p.employe_id && directeIds.includes(p.conversation_id)).map((p) => p.employe_id))
    );

    const [{ data: employesAutres }, { data: profilsAutres }] = await Promise.all([
      employeIds.length > 0 ? supabase.from("employes").select("id, nom").in("id", employeIds) : Promise.resolve({ data: [] }),
      userIds.length > 0 ? supabase.from("profils").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] }),
    ]);

    function nomParticipant(p) {
      if (p.employe_id) return employesAutres?.find((e) => e.id === p.employe_id)?.nom || "Employé";
      return profilsAutres?.find((pr) => pr.id === p.user_id)?.full_name || "Administration";
    }

    function nomAutre(conversationId) {
      const p = autresParticipants.find((a) => a.conversation_id === conversationId);
      return p ? nomParticipant(p) : "Conversation";
    }

    function membresDuGroupe(conversationId) {
      return autresParticipants.filter((a) => a.conversation_id === conversationId).map(nomParticipant);
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
      ...groupeIds.map((id) => ({
        id,
        type: "groupe",
        titre: infoPar[id]?.titre || "Groupe",
        membres: membresDuGroupe(id),
        dernierMessage: dernierPar[id]?.contenu || null,
        dernierMessageDate: dernierPar[id]?.created_at || null,
      })),
    ].sort((a, b) => new Date(b.dernierMessageDate || 0) - new Date(a.dernierMessageDate || 0));

    setConversations(liste);
    // Si la conversation affichée n'existe plus (supprimée), on revient au fil d'équipe.
    setActiveId((cur) => (cur && liste.some((c) => c.id === cur) ? cur : equipeId));
  }

  async function chargerMessages(conversationId) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(data || []);

    // Réactions (route serveur : employés et dashboard n'ont pas le même système d'identité).
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/chat/reactions?conversationId=${conversationId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) setReactions((await res.json()).reactions || {});
    } catch {}
  }

  async function reagir(m, emoji) {
    setMessageOuvertId(null);
    setReactions((cur) => ({ ...cur, [m.id]: appliquerReactionLocale(cur[m.id], emoji) }));
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await fetch("/api/chat/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ messageId: m.id, emoji }),
      });
    } catch {}
    chargerMessages(activeId);
  }

  async function handleEnvoyer(e) {
    e.preventDefault();
    if (!texte.trim() || !activeId) return;
    const contenu = texte.trim();
    setTexte("");
    presence.arreterEcriture();
    const citation = repondreA;
    setRepondreA(null);

    // Le message apparaît tout de suite ; le rechargement le remplace par le vrai.
    setMessages((actuels) => [
      ...actuels,
      { id: `tmp-${Date.now()}`, conversation_id: activeId, user_id: userId, contenu, created_at: new Date().toISOString(), reponse_a: citation?.id || null },
    ]);

    const base = { conversation_id: activeId, user_id: userId, contenu };
    let { error } = await supabase.from("messages").insert(citation ? { ...base, reponse_a: citation.id } : base);
    // Colonne reponse_a pas encore créée (SQL pas exécuté) : on envoie sans la citation.
    if (error && citation) ({ error } = await supabase.from("messages").insert(base));
    if (error) {
      setErreur("L'envoi a échoué.");
      setTexte(contenu);
      chargerMessages(activeId);
      return;
    }
    chargerMessages(activeId);
    chargerConversations({ silencieux: true });

    const {
      data: { session },
    } = await supabase.auth.getSession();
    fetch("/api/notifications/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ conversationId: activeId, contenu }),
    }).catch(() => {});
  }

  async function ouvrirConversationAvec(employeId) {
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
    setVueMobile("thread");
  }

  async function creerGroupe(e) {
    e.preventDefault();
    const nom = groupeModal.nom.trim();
    if (!nom || groupeModal.ids.size === 0) return;
    setGroupeBusy(true);
    setErreur(null);

    // Id généré ici (pas de insert().select()) : juste après la création, le
    // groupe n'a encore aucun participant, donc sa policy de lecture le cacherait.
    const conversationId = crypto.randomUUID();
    const { error } = await supabase
      .from("conversations")
      .insert({ id: conversationId, entreprise_id: entrepriseId, type: "groupe", titre: nom, cree_par: userId });
    if (error) {
      setErreur("Impossible de créer le groupe. As-tu exécuté chat_groupes.sql dans Supabase?");
      setGroupeBusy(false);
      return;
    }

    const { error: erreurParticipants } = await supabase.from("conversation_participants").insert([
      { conversation_id: conversationId, user_id: userId },
      ...[...groupeModal.ids].map((employeId) => ({ conversation_id: conversationId, employe_id: employeId })),
    ]);
    if (erreurParticipants) {
      setErreur("Le groupe a été créé, mais ses membres n'ont pas pu être ajoutés.");
    }

    setGroupeBusy(false);
    setGroupeModal(null);
    await chargerConversations();
    setActiveId(conversationId);
    setVueMobile("thread");
  }

  // Un seul message écrit, envoyé à chaque employé coché DANS SA PROPRE
  // conversation privée avec toi : ce n'est pas un groupe, les destinataires ne
  // se voient pas entre eux et leurs réponses restent séparées.
  async function envoyerDiffusion(e) {
    e.preventDefault();
    const contenu = groupeModal.message.trim();
    if (!contenu || groupeModal.ids.size === 0) return;
    setGroupeBusy(true);
    setErreur(null);

    try {
      const destinataires = [...groupeModal.ids];
      const conversationIds = await Promise.all(
        destinataires.map((employeId) => getOrCreateDirecteConversation(supabase, entrepriseId, { userId }, { employeId }))
      );

      const { error } = await supabase
        .from("messages")
        .insert(conversationIds.map((conversation_id) => ({ conversation_id, user_id: userId, contenu })));
      if (error) throw error;

      // Notification push à chacun (échecs ignorés : le message est déjà envoyé).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await Promise.all(
        conversationIds.map((conversationId) =>
          fetch("/api/notifications/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ conversationId, contenu }),
          }).catch(() => {})
        )
      );

      setConfirmation(`Message envoyé à ${destinataires.length} employé${destinataires.length > 1 ? "s" : ""}.`);
      setTimeout(() => setConfirmation(null), 5000);
      setGroupeModal(null);
      await chargerConversations();
    } catch (err) {
      console.error("Erreur envoi à plusieurs:", err);
      setErreur("L'envoi à plusieurs a échoué.");
    }
    setGroupeBusy(false);
  }

  async function supprimerConversation(conversation) {
    const message =
      conversation.type === "groupe"
        ? `Supprimer le groupe « ${conversation.titre} »? Tous les messages seront perdus, pour tout le monde. Pour reparler, il faudra créer un nouveau groupe.`
        : `Supprimer la conversation avec ${conversation.titre}? Tous les messages seront perdus, pour vous deux. Pour reparler, il faudra démarrer une nouvelle conversation.`;
    if (!window.confirm(message)) return;

    const { error } = await supabase.from("conversations").delete().eq("id", conversation.id);
    if (error) {
      setErreur("Impossible de supprimer la conversation. As-tu exécuté chat_groupes.sql dans Supabase?");
      return;
    }
    setMessages([]);
    setActiveId(null);
    setVueMobile("liste");
    await chargerConversations();
  }

  function nomExpediteur(m) {
    if (m.user_id === userId) return "Toi";
    if (m.employe_id) {
      return conversationActive?.type === "directe" ? conversationActive?.titre : employes.find((e) => e.id === m.employe_id)?.nom || "Employé";
    }
    if (m.user_id) {
      return conversationActive?.type === "directe" ? conversationActive?.titre : "Administration";
    }
    return "Compte supprimé";
  }

  const conversationActive = conversations.find((c) => c.id === activeId);

  // Tous les employés sont dans la liste d'office (même sans conversation encore) ;
  // un clic sur l'un d'eux ouvre (ou crée) sa conversation. La recherche filtre
  // seulement par NOM d'employé (les groupes et le fil d'équipe sont masqués pendant la recherche).
  const sansAccents = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const employesSansConversation = employes
    .filter((e) => !employeIdsEnDiscussion.has(e.id))
    .map((e) => ({ id: `emp:${e.id}`, type: "employe", employeId: e.id, titre: e.nom, dernierMessage: null, dernierMessageDate: null }));
  const tousLesElements = [...conversations, ...employesSansConversation];
  const q = sansAccents(recherche.trim());
  const elementsVisibles = q
    ? tousLesElements.filter((c) => (c.type === "directe" || c.type === "employe") && sansAccents(c.titre).includes(q))
    : tousLesElements;

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  if (erreur && conversations.length === 0) {
    return <p className="settings-msg err">{erreur}</p>;
  }

  return (
    <div>
      {!mobile && <h2>Discussion</h2>}
      {!mobile && <p className="panel-hint">Le fil d'équipe, une conversation avec chacun de tes employés, et tes groupes.</p>}
      {erreur && <p className="settings-msg err">{erreur}</p>}
      {confirmation && <p className="settings-msg ok">{confirmation}</p>}

      <div className={`chat-layout${mobile ? " chat-layout-mobile" : ""}`}>
        <div className={`chat-conv-list${mobile && vueMobile === "thread" ? " hidden-mobile" : ""}`}>
          <div className="chat-conv-list-head">
            <strong style={{ fontSize: "13px" }}>Conversations</strong>
            <button type="button" className="admin-icon-btn" onClick={() => setMenuNouveauOuvert((v) => !v)}>
              + Nouveau
            </button>
          </div>
          {menuNouveauOuvert && (
            <div className="chat-picker">
              <button
                type="button"
                className="chat-conv-item"
                onClick={() => {
                  setMenuNouveauOuvert(false);
                  setGroupeModal({ mode: "groupe", nom: "", message: "", ids: new Set() });
                }}
              >
                👥 Nouveau groupe
              </button>
              <button
                type="button"
                className="chat-conv-item"
                onClick={() => {
                  setMenuNouveauOuvert(false);
                  setGroupeModal({ mode: "diffusion", nom: "", message: "", ids: new Set() });
                }}
              >
                📣 Message à plusieurs
              </button>
            </div>
          )}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(var(--w),0.08)" }}>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un employé..."
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <div className="chat-section-label">{recherche.trim() ? "Résultats" : "Conversations"}</div>
          {elementsVisibles.length === 0 && <p className="chat-empty">Aucun employé trouvé.</p>}
          {elementsVisibles.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chat-conv-item${activeId === c.id ? " active" : ""}`}
              onClick={() => {
                if (c.type === "employe") ouvrirConversationAvec(c.employeId);
                else {
                  setActiveId(c.id);
                  setVueMobile("thread");
                }
              }}
            >
              <div className="chat-conv-titre">{c.type === "equipe" || c.type === "groupe" ? "👥 " : ""}{c.titre}</div>
              {c.dernierMessage ? (
                <div className="chat-conv-apercu">{c.dernierMessage}</div>
              ) : (
                (c.type === "groupe" && <div className="chat-conv-apercu">Groupe · {(c.membres?.length || 0) + 1} membres</div>) ||
                (c.type === "employe" && <div className="chat-conv-apercu">Pas encore de message</div>)
              )}
            </button>
          ))}
        </div>

        <div className={`chat-thread${mobile && vueMobile === "liste" ? " hidden-mobile" : ""}`}>
          {!activeId ? (
            <p className="chat-empty">Sélectionne une conversation.</p>
          ) : (
            <>
              {conversationActive && (mobile || conversationActive.type !== "equipe") && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 14px", borderBottom: "1px solid rgba(var(--w),0.12)" }}>
                  {mobile && (
                    <button type="button" className="admin-icon-btn" onClick={() => setVueMobile("liste")} aria-label="Retour">
                      ‹
                    </button>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong>{conversationActive.type === "groupe" || conversationActive.type === "equipe" ? "👥 " : ""}{conversationActive.titre}</strong>
                    {conversationActive.type === "groupe" && (
                      <div className="section-hint" style={{ margin: 0, fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {conversationActive.membres?.length ? `Toi, ${conversationActive.membres.join(", ")}` : "Toi seulement"}
                      </div>
                    )}
                  </div>
                  {conversationActive.type === "groupe" && (
                    <button type="button" className="admin-icon-btn danger" onClick={() => supprimerConversation(conversationActive)}>
                      Supprimer le groupe
                    </button>
                  )}
                </div>
              )}
              <div className="chat-messages">
                {messages.length === 0 && <p className="chat-empty">Aucun message pour l'instant.</p>}
                {(() => {
                  const dernierDeMoi = [...messages].reverse().find((m) => m.user_id === userId);
                  return messages.map((m) => {
                    const parent = m.reponse_a ? messages.find((x) => x.id === m.reponse_a) : null;
                    return (
                    <div key={m.id} style={{ display: "flex", flexDirection: "column" }}>
                      <BulleMessage
                        m={{
                          id: m.id,
                          auteur: nomExpediteur(m),
                          mine: m.user_id === userId,
                          contenu: m.contenu,
                          reponse: parent ? { auteur: nomExpediteur(parent), contenu: parent.contenu.slice(0, 140) } : null,
                          reactions: reactions[m.id] || [],
                          tmp: String(m.id).startsWith("tmp-"),
                        }}
                        ouvert={messageOuvertId === m.id}
                        onToggle={() => setMessageOuvertId((cur) => (cur === m.id ? null : m.id))}
                        onReagir={(emoji) => reagir(m, emoji)}
                        onRepondre={() => {
                          setRepondreA({ id: m.id, auteur: nomExpediteur(m), contenu: m.contenu.slice(0, 140) });
                          setMessageOuvertId(null);
                        }}
                      />
                      {m === dernierDeMoi && !String(m.id).startsWith("tmp-") && (
                        <LigneVu
                          vu={libelleVu({ vus: presence.vus, dernierMessageIso: m.created_at, directe: conversationActive?.type === "directe" })}
                        />
                      )}
                    </div>
                    );
                  });
                })()}
                <IndicateurEcriture ecrivent={presence.ecrivent} />
                <div ref={messagesEndRef} />
              </div>
              {repondreA && (
                <div className="chat-reponse-banniere">
                  <span>
                    Réponse à {repondreA.auteur} : {repondreA.contenu}
                  </span>
                  <button type="button" className="admin-icon-btn" onClick={() => setRepondreA(null)}>
                    ✕
                  </button>
                </div>
              )}
              <form className="chat-compose" onSubmit={handleEnvoyer}>
                <input
                  type="text"
                  value={texte}
                  onChange={(e) => {
                    setTexte(e.target.value);
                    if (e.target.value.trim()) presence.signalerEcriture();
                    else presence.arreterEcriture();
                  }}
                  placeholder="Écrire un message..."
                />
                <button type="submit" className="chat-send-btn" disabled={!texte.trim()} aria-label="Envoyer">
                  ➤
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {groupeModal && (
        <div className="modal-overlay" onClick={() => setGroupeModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{groupeModal.mode === "diffusion" ? "Message à plusieurs" : "Nouveau groupe"}</h3>
              <button className="admin-icon-btn" onClick={() => setGroupeModal(null)}>
                Fermer
              </button>
            </div>
            <form onSubmit={groupeModal.mode === "diffusion" ? envoyerDiffusion : creerGroupe}>
              {groupeModal.mode === "diffusion" ? (
                <div className="field">
                  <label>Message</label>
                  <textarea
                    value={groupeModal.message}
                    onChange={(e) => setGroupeModal((m) => ({ ...m, message: e.target.value }))}
                    placeholder="Ex: Réunion dimanche à 9 h, merci de confirmer ta présence."
                    rows={4}
                    maxLength={2000}
                    autoFocus
                    required
                    style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
                  />
                  <p className="section-hint" style={{ marginTop: "6px" }}>
                    Chaque personne cochée reçoit ce message dans sa propre conversation avec toi. Elles ne se voient pas entre
                    elles, et leurs réponses restent séparées.
                  </p>
                </div>
              ) : (
                <div className="field">
                  <label>Nom du groupe</label>
                  <input
                    type="text"
                    value={groupeModal.nom}
                    onChange={(e) => setGroupeModal((m) => ({ ...m, nom: e.target.value }))}
                    placeholder="Ex: Équipe du dimanche"
                    maxLength={60}
                    autoFocus
                    required
                  />
                </div>
              )}
              <div className="field">
                <label>
                  Membres ({groupeModal.ids.size})
                  <button
                    type="button"
                    className="admin-icon-btn"
                    style={{ marginLeft: "10px" }}
                    onClick={() =>
                      setGroupeModal((m) => ({ ...m, ids: m.ids.size === employes.length ? new Set() : new Set(employes.map((emp) => emp.id)) }))
                    }
                  >
                    {groupeModal.ids.size === employes.length ? "Tout décocher" : "Tout cocher"}
                  </button>
                </label>
                <div style={{ maxHeight: "260px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {employes.map((emp) => (
                    <label key={emp.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 4px" }}>
                      <input
                        type="checkbox"
                        checked={groupeModal.ids.has(emp.id)}
                        onChange={() =>
                          setGroupeModal((m) => {
                            const ids = new Set(m.ids);
                            if (ids.has(emp.id)) ids.delete(emp.id);
                            else ids.add(emp.id);
                            return { ...m, ids };
                          })
                        }
                      />
                      {emp.nom}
                    </label>
                  ))}
                  {employes.length === 0 && <p className="chat-empty">Aucun employé pour l&apos;instant.</p>}
                </div>
              </div>
              <div className="admin-edit-actions">
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={
                    groupeBusy ||
                    groupeModal.ids.size === 0 ||
                    (groupeModal.mode === "diffusion" ? !groupeModal.message.trim() : !groupeModal.nom.trim())
                  }
                >
                  {groupeModal.mode === "diffusion"
                    ? groupeBusy
                      ? "Envoi..."
                      : `Envoyer à ${groupeModal.ids.size} personne${groupeModal.ids.size > 1 ? "s" : ""}`
                    : groupeBusy
                    ? "Création..."
                    : "Créer le groupe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
