"use client";

import { useEffect, useRef, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { localeDate } from "@/lib/i18n/moi";
import RappelNotifications from "@/components/moi/RappelNotifications";
import { useLangue } from "@/components/moi/LangueContext";

// Dernier message vu par conversation, mémorisé sur l'appareil (les employés n'ont
// pas de compte où l'enregistrer) : sert à mettre en évidence les messages non lus.
const CLE_LUS = "gozly_chat_lus";

import { useChatPresence } from "@/lib/useChatPresence";
import { libelleVu, LigneVu, IndicateurEcriture } from "@/components/chat/IndicateursChat";
import BulleMessage, { appliquerReactionLocale } from "@/components/chat/BulleMessage";
import { IconEnvoyer, IconFlecheGauche, IconPlus, IconProfil, IconProfils, IconX } from "@/components/icons/Pictogrammes";

export default function DiscussionEmploye() {
  const { t, langue } = useLangue();
  const [lus, setLus] = useState({});
  const vueRef = useRef("liste");
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeTitre, setActiveTitre] = useState("");
  const [messages, setMessages] = useState([]);
  const [texte, setTexte] = useState("");
  const [collegues, setCollegues] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tous, setTous] = useState([]); // tous les collègues (groupes + recherche)
  const [menuNouveau, setMenuNouveau] = useState(false);
  const [groupeOuvert, setGroupeOuvert] = useState(false);
  const [groupeNom, setGroupeNom] = useState("");
  const [groupeIds, setGroupeIds] = useState(() => new Set());
  const [groupeBusy, setGroupeBusy] = useState(false);
  const [groupeErreur, setGroupeErreur] = useState("");
  const [recherche, setRecherche] = useState("");
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [vue, setVue] = useState("liste"); // "liste" | "thread"
  const messagesRef = useRef(null);
  const dernierIdRef = useRef(null);
  const presDuBasRef = useRef(true);
  const pollRef = useRef(null);
  const [messageOuvertId, setMessageOuvertId] = useState(null);
  const [repondreA, setRepondreA] = useState(null); // { id, auteur, contenu }
  const [echangeOuvert, setEchangeOuvert] = useState(false);
  const [mesQuarts, setMesQuarts] = useState(null); // null = pas encore chargés
  const [echangeBusy, setEchangeBusy] = useState(false);
  const [echangeErreur, setEchangeErreur] = useState("");
  const presence = useChatPresence(vue === "thread" ? activeId : null, async (corps) => {
    const res = await employeFetch("/api/employe-app/chat/presence", { method: "POST", body: JSON.stringify(corps) });
    return res.ok ? res.json() : null;
  });

  // Discussion directe avec un collègue (pas l'administration, pas un groupe) : on peut lui proposer un échange.
  const conversationActive = conversations.find((c) => c.id === activeId);
  const autreEmployeIdActif = conversationActive?.type === "directe" ? conversationActive.autreEmployeId : null;

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
      setTous(data.tous || []);
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
    setMessages((actuels) => (JSON.stringify(actuels) === JSON.stringify(nouveaux) ? actuels : nouveaux));
  }

  function ouvrirConversation(c) {
    marquerLu(c.id, c.dernierMessageDate);
    if (c.id !== activeId) setMessages([]);
    setActiveId(c.id);
    setActiveTitre(c.titre);
    setVue("thread");
  }

  async function reagir(m, emoji) {
    setMessageOuvertId(null);
    setMessages((actuels) => actuels.map((x) => (x.id === m.id ? { ...x, reactions: appliquerReactionLocale(x.reactions, emoji) } : x)));
    try {
      await employeFetch("/api/employe-app/chat/reactions", { method: "POST", body: JSON.stringify({ messageId: m.id, emoji }) });
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

    // Le message apparaît tout de suite (sans rechargement), puis est remplacé par le vrai.
    const idTemporaire = `tmp-${Date.now()}`;
    setMessages((actuels) => [
      ...actuels,
      {
        id: idTemporaire,
        contenu,
        createdAt: new Date().toISOString(),
        expediteurNom: "",
        deMoi: true,
        reponse: citation ? { auteur: citation.auteur, contenu: citation.contenu } : null,
        reactions: [],
      },
    ]);

    try {
      const res = await employeFetch("/api/employe-app/chat/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId: activeId, contenu, reponseA: citation?.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.message) throw new Error("envoi");
      setMessages((actuels) => {
        const sansDoublon = actuels.filter((m) => m.id !== data.message.id);
        return sansDoublon.map((m) => (m.id === idTemporaire ? data.message : m));
      });
    } catch {
      // Échec : on retire le message et on remet le texte pour réessayer.
      setMessages((actuels) => actuels.filter((m) => m.id !== idTemporaire));
      setTexte(contenu);
      return;
    }
    chargerConversations({ silencieux: true });
  }

  // Proposer un échange de quart à l'autre personne d'une discussion directe : crée la vraie
  // demande (onglet Demandes, notification push) puis écrit un message dans la conversation.
  async function ouvrirEchange() {
    setEchangeErreur("");
    setEchangeOuvert(true);
    if (mesQuarts) return;
    try {
      const res = await employeFetch("/api/employe-app/demandes/mes-quarts");
      const data = await res.json();
      setMesQuarts(data.quarts || []);
    } catch {
      setMesQuarts([]);
    }
  }

  async function proposerEchange(quart, autreEmployeId) {
    if (echangeBusy) return;
    setEchangeBusy(true);
    setEchangeErreur("");
    try {
      const res = await employeFetch("/api/employe-app/demandes/echanges", {
        method: "POST",
        body: JSON.stringify({ quartId: quart.id, avecEmployeId: autreEmployeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEchangeErreur(data.error || t("chat.echangeErreur"));
        setEchangeBusy(false);
        return;
      }
      const contenu = t("chat.echangeMessage", {
        date: new Date(quart.date).toLocaleDateString(localeDate(langue)),
        debut: quart.heure_debut.slice(0, 5),
        fin: quart.heure_fin.slice(0, 5),
      });
      await employeFetch("/api/employe-app/chat/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId: activeId, contenu }),
      });
      setEchangeOuvert(false);
      chargerMessages(activeId);
      chargerConversations({ silencieux: true });
    } catch {
      setEchangeErreur(t("chat.echangeErreur"));
    }
    setEchangeBusy(false);
  }

  async function creerGroupe(e) {
    e.preventDefault();
    if (!groupeNom.trim() || groupeIds.size === 0) return;
    setGroupeBusy(true);
    setGroupeErreur("");
    try {
      const res = await employeFetch("/api/employe-app/chat/conversations/groupe", {
        method: "POST",
        body: JSON.stringify({ titre: groupeNom.trim(), employeIds: [...groupeIds] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.conversationId) {
        setGroupeErreur(data.error || t("chat.erreurGroupe"));
        setGroupeBusy(false);
        return;
      }
      setGroupeOuvert(false);
      setGroupeNom("");
      setGroupeIds(new Set());
      await chargerConversations();
      setMessages([]);
      setActiveId(data.conversationId);
      setActiveTitre(data.titre || groupeNom.trim());
      setVue("thread");
    } catch {
      setGroupeErreur(t("chat.erreurGroupe"));
    }
    setGroupeBusy(false);
  }

  // Sans accents ni majuscules, pour que « eve » trouve « Ève ».
  const normaliser = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const terme = normaliser(recherche);
  const conversationsVisibles = terme ? conversations.filter((c) => normaliser(c.titre).includes(terme)) : conversations;
  // Collègues pas encore en discussion directe : on peut démarrer avec eux depuis la recherche.
  const colleguesTrouves = terme ? tous.filter((c) => !c.dejaEnDiscussion && normaliser(c.nom).includes(terme)) : [];

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
          <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(var(--w),0.08)" }}>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder={t("chat.rechercher")}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <div className="chat-section-label">{terme ? t("chat.resultats") : t("chat.conversations")}</div>
          {terme && conversationsVisibles.length === 0 && colleguesTrouves.length === 0 && <p className="chat-empty">{t("chat.aucunResultat")}</p>}
          {conversationsVisibles.map((c) => {
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
                  {c.type === "equipe" || c.type === "groupe" ? <><IconProfils className="gozly-icon" /> </> : ""}
                  {c.titre}
                  {nonLu && <span className="chat-conv-pastille" aria-label="Nouveau message" />}
                </div>
                {c.dernierMessage && <div className="chat-conv-apercu">{c.dernierMessage}</div>}
              </button>
            );
          })}
          {colleguesTrouves.length > 0 && (
            <>
              <div className="chat-section-label">{t("chat.autresCollegues")}</div>
              {colleguesTrouves.map((c) => (
                <button key={c.id} type="button" className="chat-conv-item" onClick={() => demarrerConversation(c.id, c.nom)}>
                  <div className="chat-conv-titre">{c.nom}</div>
                </button>
              ))}
            </>
          )}
        </div>

        {vue === "thread" && (
          <div className="chat-thread">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderBottom: "1px solid rgba(var(--w),0.1)" }}>
              <button type="button" className="admin-icon-btn" onClick={() => setVue("liste")}>
                <IconFlecheGauche className="gozly-icon" />
              </button>
              <strong style={{ fontSize: "14px" }}>{activeTitre}</strong>
            </div>
            <div className="chat-messages" ref={messagesRef} onScroll={surDefilement}>
              {messages.length === 0 && <p className="chat-empty">{t("chat.aucunMessage")}</p>}
              {(() => {
                const dernierDeMoi = [...messages].reverse().find((m) => m.deMoi);
                const textesChat = {
                  vu: t("chat.vu"),
                  vuPar: (noms) => t("chat.vuPar", { noms }),
                  vuNombre: (n) => t("chat.vuNombre", { n }),
                  ecrit: (nom) => t("chat.ecrit", { nom }),
                  ecritDeux: (a, b) => t("chat.ecritDeux", { a, b }),
                  ecritPlusieurs: t("chat.ecritPlusieurs"),
                };
                const directe = conversations.find((c) => c.id === activeId)?.type === "directe";
                return (
                  <>
                    {messages.map((m) => (
                      <div key={m.id} style={{ display: "flex", flexDirection: "column" }}>
                        <BulleMessage
                          m={{
                            id: m.id,
                            auteur: m.deMoi ? t("chat.toi") : m.expediteurNom,
                            mine: m.deMoi,
                            contenu: m.contenu,
                            reponse: m.reponse ? { auteur: m.reponse.deMoi ? t("chat.toi") : m.reponse.auteur, contenu: m.reponse.contenu } : null,
                            reactions: m.reactions || [],
                            tmp: String(m.id).startsWith("tmp-"),
                          }}
                          ouvert={messageOuvertId === m.id}
                          onToggle={() => setMessageOuvertId((cur) => (cur === m.id ? null : m.id))}
                          onReagir={(emoji) => reagir(m, emoji)}
                          onRepondre={() => {
                            setRepondreA({ id: m.id, auteur: m.deMoi ? t("chat.toi") : m.expediteurNom, contenu: m.contenu.slice(0, 140) });
                            setMessageOuvertId(null);
                          }}
                          texteRepondre={t("chat.repondre")}
                        />
                        {m === dernierDeMoi && !String(m.id).startsWith("tmp-") && (
                          <LigneVu vu={libelleVu({ vus: presence.vus, dernierMessageIso: m.createdAt, directe, textes: textesChat })} />
                        )}
                      </div>
                    ))}
                    <IndicateurEcriture ecrivent={presence.ecrivent} textes={textesChat} />
                  </>
                );
              })()}
            </div>
            {repondreA && (
              <div className="chat-reponse-banniere">
                <span>
                  {t("chat.reponseA", { nom: repondreA.auteur })} : {repondreA.contenu}
                </span>
                <button type="button" className="admin-icon-btn" onClick={() => setRepondreA(null)}>
                  <IconX className="gozly-icon" />
                </button>
              </div>
            )}
            <form className="chat-compose" onSubmit={handleEnvoyer}>
              {!texte && autreEmployeIdActif && (
                <button type="button" className="chat-plus-btn" onClick={ouvrirEchange} aria-label={t("chat.plus")}>
                  <IconPlus className="gozly-icon" />
                </button>
              )}
              <input
                type="text"
                value={texte}
                onChange={(e) => {
                  setTexte(e.target.value);
                  if (e.target.value.trim()) presence.signalerEcriture();
                  else presence.arreterEcriture();
                }}
                placeholder={t("chat.placeholder")}
              />
              <button type="submit" className="chat-send-btn" disabled={!texte.trim()} aria-label="Envoyer">
                <IconEnvoyer className="gozly-icon" />
              </button>
            </form>
          </div>
        )}
      </div>

      {echangeOuvert && autreEmployeIdActif && (
        <div className="modal-overlay" onClick={() => setEchangeOuvert(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("chat.proposerEchange")}</h3>
              <button className="admin-icon-btn" onClick={() => setEchangeOuvert(false)}>
                {t("nav.fermer")}
              </button>
            </div>
            <p className="panel-hint">{t("chat.echangeChoisir", { nom: activeTitre })}</p>
            {echangeErreur && <p className="settings-msg err">{echangeErreur}</p>}
            {mesQuarts === null ? (
              <p style={{ color: "var(--text-dim)" }}>{t("nav.chargement")}</p>
            ) : mesQuarts.length === 0 ? (
              <p className="chat-empty">{t("demandes.aucunQuartSemaine")}</p>
            ) : (
              <div className="admin-list">
                {mesQuarts.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    className="admin-row"
                    style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                    disabled={echangeBusy}
                    onClick={() => proposerEchange(q, autreEmployeIdActif)}
                  >
                    <div className="admin-row-main">
                      <div className="admin-row-title">{new Date(q.date).toLocaleDateString(localeDate(langue))}</div>
                      <div className="admin-row-sub">
                        {q.heure_debut.slice(0, 5)}–{q.heure_fin.slice(0, 5)}
                        {q.poste ? ` · ${q.poste}` : ""}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {vue === "liste" && (
        <button type="button" className="moi-discussion-add-btn" onClick={() => setMenuNouveau(true)}>
          {t("chat.nouveau")}
        </button>
      )}

      {menuNouveau && (
        <div className="modal-overlay" onClick={() => setMenuNouveau(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("chat.nouveauTitre")}</h3>
              <button className="admin-icon-btn" onClick={() => setMenuNouveau(false)}>
                {t("nav.fermer")}
              </button>
            </div>
            <div className="dash-nav">
              <button
                type="button"
                className="dash-nav-item"
                onClick={() => {
                  setMenuNouveau(false);
                  setPickerOpen(true);
                }}
              >
                <IconProfil className="gozly-icon" /> {t("chat.unContact")}
              </button>
              <button
                type="button"
                className="dash-nav-item"
                onClick={() => {
                  setMenuNouveau(false);
                  setGroupeErreur("");
                  setGroupeOuvert(true);
                }}
              >
                <IconProfils className="gozly-icon" /> {t("chat.unGroupe")}
              </button>
            </div>
          </div>
        </div>
      )}

      {groupeOuvert && (
        <div className="modal-overlay" onClick={() => setGroupeOuvert(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("chat.unGroupe")}</h3>
              <button className="admin-icon-btn" onClick={() => setGroupeOuvert(false)}>
                {t("nav.fermer")}
              </button>
            </div>
            <form onSubmit={creerGroupe}>
              <div className="field">
                <input
                  type="text"
                  value={groupeNom}
                  onChange={(e) => setGroupeNom(e.target.value)}
                  placeholder={t("chat.nomGroupe")}
                  maxLength={60}
                />
              </div>
              <p className="section-hint" style={{ margin: "0 0 6px" }}>
                {t("chat.choisirMembres")}
              </p>
              {tous.length === 0 ? (
                <p className="chat-empty">{t("chat.aucunCollegue")}</p>
              ) : (
                <div className="moi-picker-list">
                  {tous.map((c) => (
                    <label className="moi-picker-row" key={c.id} style={{ cursor: "pointer" }}>
                      <span>{c.nom}</span>
                      <input
                        type="checkbox"
                        checked={groupeIds.has(c.id)}
                        onChange={() =>
                          setGroupeIds((prev) => {
                            const suivant = new Set(prev);
                            if (suivant.has(c.id)) suivant.delete(c.id);
                            else suivant.add(c.id);
                            return suivant;
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
              {groupeErreur && <p className="settings-msg err">{groupeErreur}</p>}
              <button type="submit" className="submit-btn" style={{ width: "100%", marginTop: "10px" }} disabled={groupeBusy || !groupeNom.trim() || groupeIds.size === 0}>
                {groupeBusy ? t("chat.creation") : t("chat.creerGroupe")}
              </button>
            </form>
          </div>
        </div>
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
