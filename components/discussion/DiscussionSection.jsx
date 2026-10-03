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
  const [recherche, setRecherche] = useState("");
  const [idsAvecMessage, setIdsAvecMessage] = useState(new Set()); // conversations dont un message contient la recherche
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [groupeModal, setGroupeModal] = useState(null); // { nom, ids: Set d'employés } quand la fenêtre de création est ouverte
  const [groupeBusy, setGroupeBusy] = useState(false);
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
    const q = recherche.trim();
    if (q.length < 3) {
      setIdsAvecMessage(new Set());
      return;
    }
    const delai = setTimeout(async () => {
      const { data } = await supabase.from("messages").select("conversation_id").ilike("contenu", `%${q}%`).limit(300);
      setIdsAvecMessage(new Set((data || []).map((m) => m.conversation_id)));
    }, 300);
    return () => clearTimeout(delai);
  }, [recherche]);

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
  }

  async function handleEnvoyer(e) {
    e.preventDefault();
    if (!texte.trim() || !activeId) return;
    const contenu = texte.trim();
    setTexte("");

    await supabase.from("messages").insert({ conversation_id: activeId, user_id: userId, contenu });
    chargerMessages(activeId);
    chargerConversations();

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
  // par nom, par dernier message, et par tout message contenant le texte (3 lettres min).
  const sansAccents = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const employesSansConversation = employes
    .filter((e) => !employeIdsEnDiscussion.has(e.id))
    .map((e) => ({ id: `emp:${e.id}`, type: "employe", employeId: e.id, titre: e.nom, dernierMessage: null, dernierMessageDate: null }));
  const tousLesElements = [...conversations, ...employesSansConversation];
  const q = sansAccents(recherche.trim());
  const elementsVisibles = q
    ? tousLesElements.filter(
        (c) => sansAccents(c.titre).includes(q) || sansAccents(c.dernierMessage).includes(q) || idsAvecMessage.has(c.id)
      )
    : tousLesElements;

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  if (erreur && conversations.length === 0) {
    return <p className="settings-msg err">{erreur}</p>;
  }

  return (
    <div>
      <h2>Discussion</h2>
      <p className="panel-hint">Le fil d'équipe, une conversation avec chacun de tes employés, et tes groupes.</p>
      {erreur && <p className="settings-msg err">{erreur}</p>}

      <div className="chat-layout">
        <div className="chat-conv-list">
          <div className="chat-conv-list-head">
            <strong style={{ fontSize: "13px" }}>Conversations</strong>
            <button type="button" className="admin-icon-btn" onClick={() => setGroupeModal({ nom: "", ids: new Set() })}>
              + Nouveau groupe
            </button>
          </div>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(var(--w),0.08)" }}>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une discussion..."
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <div className="chat-section-label">{recherche.trim() ? "Résultats" : "Conversations"}</div>
          {elementsVisibles.length === 0 && <p className="chat-empty">Aucune discussion trouvée.</p>}
          {elementsVisibles.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chat-conv-item${activeId === c.id ? " active" : ""}`}
              onClick={() => (c.type === "employe" ? ouvrirConversationAvec(c.employeId) : setActiveId(c.id))}
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

        <div className="chat-thread">
          {!activeId ? (
            <p className="chat-empty">Sélectionne une conversation.</p>
          ) : (
            <>
              {conversationActive && conversationActive.type !== "equipe" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 14px", borderBottom: "1px solid rgba(var(--w),0.12)" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{conversationActive.type === "groupe" ? "👥 " : ""}{conversationActive.titre}</strong>
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

      {groupeModal && (
        <div className="modal-overlay" onClick={() => setGroupeModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Nouveau groupe</h3>
              <button className="admin-icon-btn" onClick={() => setGroupeModal(null)}>
                Fermer
              </button>
            </div>
            <form onSubmit={creerGroupe}>
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
                <button type="submit" className="submit-btn" disabled={groupeBusy || !groupeModal.nom.trim() || groupeModal.ids.size === 0}>
                  {groupeBusy ? "Création..." : "Créer le groupe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
