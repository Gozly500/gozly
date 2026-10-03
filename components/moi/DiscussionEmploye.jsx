"use client";

import { useEffect, useRef, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import RappelNotifications from "@/components/moi/RappelNotifications";
import { useLangue } from "@/components/moi/LangueContext";

// Dernier message vu par conversation, mémorisé sur l'appareil (les employés n'ont
// pas de compte où l'enregistrer) : sert à mettre en évidence les messages non lus.
const CLE_LUS = "gozly_chat_lus";

export default function DiscussionEmploye() {
  const { t } = useLangue();
  const [lus, setLus] = useState({});
  const vueRef = useRef("liste");
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
  const messagesRef = useRef(null);
  const dernierIdRef = useRef(null);
  const presDuBasRef = useRef(true);
  const pollRef = useRef(null);

  useEffect(() => {
    try {
      setLus(JSON.parse(window.localStorage.getItem(CLE_LUS) || "{}"));
    } catch {}

    // La liste se met à jour toute seule (nouveau message d'un collègue) tant qu'on la regarde.
    const idListe = setInterval(() => {
      if (document.visibilityState === "visible" && vueRef.current === "liste") chargerConversations({ silencieux: true });
    }, 10000);

    chargerConversations();
    employeFetch("/api/employe-app/chat/collegues").then(async (res) => {
      const data = await res.json();
      setCollegues(data.collegues || []);
    });

    return () => clearInterval(idListe);
  }, []);

  vueRef.current = vue;

  function marquerLu(conversationId, dateIso) {
    if (!dateIso) return;
    setLus((precedent) => {
      if (precedent[conversationId] && new Date(precedent[conversationId]) >= new Date(dateIso)) return precedent;
      const suivant = { ...precedent, [conversationId]: dateIso };
      try {
        window.localStorage.setItem(CLE_LUS, JSON.stringify(suivant));
      } catch {}
      return suivant;
    });
  }

  // Première utilisation sur cet appareil : tout ce qui existe déjà compte comme lu
  // (sinon toutes les conversations seraient en gras d'un coup).
  function initialiserLus(liste) {
    try {
      if (window.localStorage.getItem(CLE_LUS) !== null) return;
      const initial = {};
      for (const c of liste) if (c.dernierMessageDate) initial[c.id] = c.dernierMessageDate;
      window.localStorage.setItem(CLE_LUS, JSON.stringify(initial));
      setLus(initial);
    } catch {}
  }

  useEffect(() => {
    if (!activeId) return;
    chargerMessages(activeId);
    pollRef.current = setInterval(() => chargerMessages(activeId), 4000);
    return () => clearInterval(pollRef.current);
  }, [activeId]);

  // À l'ouverture d'une conversation, on repart en bas.
  useEffect(() => {
    dernierIdRef.current = null;
    presDuBasRef.current = true;
  }, [vue, activeId]);

  // Le rechargement automatique (toutes les 4 s) ne doit JAMAIS ramener en
  // bas quelqu'un qui lit plus haut : on ne défile que s'il y a un nouveau
  // message ET que la personne était déjà en bas (ou que c'est son message).
  // On agit sur le conteneur des messages plutôt que scrollIntoView, qui
  // faisait aussi défiler la page entière.
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const dernier = messages[messages.length - 1];
    const nouveauMessage = (dernier?.id ?? null) !== dernierIdRef.current;
    dernierIdRef.current = dernier?.id ?? null;
    if (nouveauMessage && (presDuBasRef.current || dernier?.deMoi)) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, vue]);

  function surDefilement() {
    const el = messagesRef.current;
    if (!el) return;
    presDuBasRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function chargerConversations({ silencieux = false } = {}) {
    if (!silencieux) setLoading(true);
    if (!silencieux) setErreur(null);
    try {
      const res = await employeFetch("/api/employe-app/chat/conversations");
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error || t("chat.erreurChargement"));
      } else {
        setConversations(data.conversations || []);
        initialiserLus(data.conversations || []);
      }
    } catch (err) {
      console.error("Erreur chargement conversations:", err);
      setErreur(t("chat.erreurChargement"));
    }
    setLoading(false);
  }

  async function chargerMessages(conversationId) {
    const res = await employeFetch(`/api/employe-app/chat/messages?conversationId=${conversationId}`);
    if (res.status === 403 || res.status === 404) {
      // La conversation n'existe plus (supprimée) : on revient à la liste.
      setActiveId(null);
      setMessages([]);
      setVue("liste");
      chargerConversations();
      return;
    }
    const data = await res.json();
    const nouveaux = data.messages || [];
    // On regarde cette conversation : son dernier message compte comme lu.
    const dernierRecu = nouveaux[nouveaux.length - 1];
    if (dernierRecu && vueRef.current === "thread") marquerLu(conversationId, dernierRecu.createdAt);
    // Même liste qu'avant : on garde la référence pour ne pas re-rendre.
    setMessages((actuels) =>
      actuels.length === nouveaux.length && actuels[actuels.length - 1]?.id === nouveaux[nouveaux.length - 1]?.id
        ? actuels
        : nouveaux
    );
  }

  function ouvrirConversation(c) {
    marquerLu(c.id, c.dernierMessageDate);
    if (c.id !== activeId) setMessages([]);
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
        setErreur(data.error || t("chat.erreurDemarrage"));
        return;
      }
      await chargerConversations();
      if (data.conversationId !== activeId) setMessages([]);
      setActiveId(data.conversationId);
      setActiveTitre(nom);
      setVue("thread");
    } catch (err) {
      console.error("Erreur création conversation:", err);
      setErreur(t("chat.erreurDemarrage"));
    }
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>{t("nav.chargement")}</p>;
  }

  if (erreur && conversations.length === 0) {
    return <p className="settings-msg err">{erreur}</p>;
  }

  return (
    <div className="moi-discussion">
      {erreur && <p className="settings-msg err" style={{ margin: "0 0 10px" }}>{erreur}</p>}
      {vue === "liste" && <RappelNotifications types={["notif_messages"]} sujet="messages" />}
      <div className="chat-layout">
        <div className={`chat-conv-list${vue === "thread" ? " hidden-mobile" : ""}`}>
          <div className="chat-conv-list-head">
            <strong style={{ fontSize: "13px" }}>{t("chat.titre")}</strong>
          </div>
          <div className="chat-section-label">{t("chat.conversations")}</div>
          {conversations.map((c) => {
            // Non lu : un message d'un AUTRE, plus récent que le dernier que j'ai vu.
            const nonLu =
              !!c.dernierMessageDate &&
              !c.dernierDeMoi &&
              (!lus[c.id] || new Date(c.dernierMessageDate) > new Date(lus[c.id]));
            return (
              <button
                key={c.id}
                type="button"
                className={`chat-conv-item${activeId === c.id && vue === "thread" ? " active" : ""}${nonLu ? " non-lu" : ""}`}
                onClick={() => ouvrirConversation(c)}
              >
                <div className="chat-conv-titre">
                  {c.type === "equipe" || c.type === "groupe" ? "👥 " : ""}
                  {c.titre}
                  {nonLu && <span className="chat-conv-pastille" aria-label="Nouveau message" />}
                </div>
                {c.dernierMessage && <div className="chat-conv-apercu">{c.dernierMessage}</div>}
              </button>
            );
          })}
        </div>

        {vue === "thread" && (
          <div className="chat-thread">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderBottom: "1px solid rgba(var(--w),0.1)" }}>
              <button type="button" className="admin-icon-btn" onClick={() => setVue("liste")}>
                ‹
              </button>
              <strong style={{ fontSize: "14px" }}>{activeTitre}</strong>
            </div>
            <div className="chat-messages" ref={messagesRef} onScroll={surDefilement}>
              {messages.length === 0 && <p className="chat-empty">{t("chat.aucunMessage")}</p>}
              {messages.map((m) => (
                <div key={m.id} className={`chat-bubble-row${m.deMoi ? " mine" : ""}`}>
                  <div className="chat-bubble-auteur">{m.deMoi ? t("chat.toi") : m.expediteurNom}</div>
                  <div className="chat-bubble">{m.contenu}</div>
                </div>
              ))}
            </div>
            <form className="chat-compose" onSubmit={handleEnvoyer}>
              <input type="text" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={t("chat.placeholder")} />
              <button type="submit" className="chat-send-btn" disabled={!texte.trim()} aria-label="Envoyer">
                ➤
              </button>
            </form>
          </div>
        )}
      </div>

      {vue === "liste" && (
        <button type="button" className="moi-discussion-add-btn" onClick={() => setPickerOpen(true)}>
          {t("chat.ajouter")}
        </button>
      )}

      {pickerOpen && (
        <div className="modal-overlay" onClick={() => setPickerOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("chat.demarrerAvec")}</h3>
              <button className="admin-icon-btn" onClick={() => setPickerOpen(false)}>
                {t("nav.fermer")}
              </button>
            </div>
            {collegues.length === 0 ? (
              <p className="chat-empty">{t("chat.aucunCollegue")}</p>
            ) : (
              <div className="moi-picker-list">
                {collegues.map((c) => (
                  <div className="moi-picker-row" key={c.id}>
                    <span>{c.nom}</span>
                    <button type="button" className="admin-icon-btn" onClick={() => demarrerConversation(c.id, c.nom)}>
                      {t("chat.ajouterAction")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
