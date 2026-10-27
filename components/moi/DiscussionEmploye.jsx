"use client";

import { useEffect, useRef, useState } from "react";
import ChargementAnimation from "@/components/moi/ChargementAnimation";
import Squelettes from "@/components/moi/Squelettes";
import { employeFetch } from "@/lib/employeAuth";
import { localeDate } from "@/lib/i18n/moi";
import { dansLeQuart, erreurPlage } from "@/lib/echangeQuart";
import RappelEmployeModal from "@/components/moi/RappelEmployeModal";
import Pictos from "@/components/icons/Pictos";
import { badgeEchange } from "@/components/moi/DemandesEmploye";
import RappelNotifications from "@/components/moi/RappelNotifications";
import { useLangue } from "@/components/moi/LangueContext";

// Dernier message vu par conversation, mémorisé sur l'appareil (les employés n'ont
// pas de compte où l'enregistrer) : sert à mettre en évidence les messages non lus.
import { CLE_LUS, ecrireLus } from "@/lib/chatLus";

import { useChatPresence } from "@/lib/useChatPresence";
import Avatar from "@/components/Avatar";
import { libelleVu, LigneVu, IndicateurEcriture } from "@/components/chat/IndicateursChat";
import BulleMessage, { appliquerReactionLocale } from "@/components/chat/BulleMessage";
import { IconCloche, IconClocheBarree, IconEnvoyer, IconFlecheGauche, IconPlus, IconProfil, IconProfils, IconX } from "@/components/icons/Pictogrammes";

export default function DiscussionEmploye() {
  const { t, langue } = useLangue();
  const [lus, setLus] = useState({});
  const vueRef = useRef("liste");
  const ouvertDepuisUrl = useRef(false);
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
  // Messages déjà là à l'ouverture d'une conversation : seuls ceux arrivés ensuite jouent l'animation d'arrivée.
  const messagesConnusRef = useRef({ conversationId: null, ids: new Set() });
  const dernierIdRef = useRef(null);
  const presDuBasRef = useRef(true);
  const pollRef = useRef(null);
  const [messageOuvertId, setMessageOuvertId] = useState(null);
  const [repondreA, setRepondreA] = useState(null); // { id, auteur, contenu }
  const [permissions, setPermissions] = useState({ groupes: true, multi: true, rappels: true }); // posées par le propriétaire
  const [rappelOuvert, setRappelOuvert] = useState(null); // { fixes: [id] | null, nom }
  const [suppressionOuverte, setSuppressionOuverte] = useState(false);
  const [suppressionBusy, setSuppressionBusy] = useState(false);
  const [suppressionErreur, setSuppressionErreur] = useState("");
  const [multiOuvert, setMultiOuvert] = useState(false);
  const [multiIds, setMultiIds] = useState(() => new Set());
  const [multiTexte, setMultiTexte] = useState("");
  const [multiBusy, setMultiBusy] = useState(false);
  const [multiMsg, setMultiMsg] = useState(null); // { type: "ok" | "err", text }
  const [menuPlus, setMenuPlus] = useState(false);
  const [echangeOuvert, setEchangeOuvert] = useState(false);
  const [mesQuarts, setMesQuarts] = useState(null); // null = pas encore chargés
  const [quartEchange, setQuartEchange] = useState(null); // quart choisi dans la fenêtre, avant l'envoi
  const [echDebut, setEchDebut] = useState("");
  const [echFin, setEchFin] = useState("");
  const [echangeBusy, setEchangeBusy] = useState(false);
  const [echangeErreur, setEchangeErreur] = useState("");
  // Gestion d'un groupe : membres, rôle, ajout / retrait.
  const [membres, setMembres] = useState(null); // null = pas chargés
  const [suisAdmin, setSuisAdmin] = useState(false);
  const [membresOuvert, setMembresOuvert] = useState(false);
  const [ajoutIds, setAjoutIds] = useState(() => new Set());
  const [gestionBusy, setGestionBusy] = useState(false);
  const [gestionErreur, setGestionErreur] = useState("");
  const [retraitConfirmeId, setRetraitConfirmeId] = useState(null);
  const presence = useChatPresence(vue === "thread" ? activeId : null, async (corps) => {
    const res = await employeFetch("/api/employe-app/chat/presence", { method: "POST", body: JSON.stringify(corps) });
    return res.ok ? res.json() : null;
  });

  // Discussion directe avec un collègue (pas l'administration, pas un groupe) : on peut lui proposer un échange.
  const conversationActive = conversations.find((c) => c.id === activeId);
  const autreEmployeIdActif = conversationActive?.type === "directe" && !conversationActive.bloquee ? conversationActive.autreEmployeId : null;

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

  const estGroupeActif = conversationActive?.type === "groupe";
  const nbSysteme = messages.filter((m) => m.systeme).length;
  useEffect(() => {
    setMembres(null);
    setMembresOuvert(false);
  }, [activeId]);
  // Les membres se rechargent à l'ouverture du groupe et chaque fois qu'un message d'information arrive (quelqu'un part, est ajouté…).
  useEffect(() => {
    if (!activeId || !estGroupeActif) return;
    let ignore = false;
    employeFetch(`/api/employe-app/chat/conversations/groupe/gerer?conversationId=${activeId}`)
      .then(async (res) => {
        if (!res.ok || ignore) return;
        const data = await res.json();
        setMembres(data.membres || []);
        setSuisAdmin(!!data.suisAdmin);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [activeId, estGroupeActif, nbSysteme]);

  async function gererGroupe(corps) {
    if (gestionBusy || !activeId) return false;
    setGestionBusy(true);
    setGestionErreur("");
    try {
      const res = await employeFetch("/api/employe-app/chat/conversations/groupe/gerer", { method: "POST", body: JSON.stringify({ conversationId: activeId, ...corps }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGestionErreur(data.error || t("chat.gestionErreur"));
        setGestionBusy(false);
        return false;
      }
      const rafraichi = await employeFetch(`/api/employe-app/chat/conversations/groupe/gerer?conversationId=${activeId}`);
      if (rafraichi.ok) {
        const d = await rafraichi.json();
        setMembres(d.membres || []);
        setSuisAdmin(!!d.suisAdmin);
      }
      chargerMessages(activeId);
    } catch {
      setGestionErreur(t("chat.gestionErreur"));
      setGestionBusy(false);
      return false;
    }
    setGestionBusy(false);
    return true;
  }

  async function ajouterAuGroupe() {
    if (ajoutIds.size === 0) return;
    if (await gererGroupe({ action: "ajouter", employeIds: [...ajoutIds] })) setAjoutIds(new Set());
  }

  function texteSysteme(s) {
    const noms = Array.isArray(s.noms) ? s.noms.join(", ") : "";
    switch (s.type) {
      case "quitte":
        return t("chat.sysQuitte", { nom: s.nom });
      case "ajoute":
        return t("chat.sysAjoute", { acteur: s.acteur, noms });
      case "retire":
        return t("chat.sysRetire", { acteur: s.acteur, nom: s.nom });
      case "admin":
        return t("chat.sysAdmin", { acteur: s.acteur, nom: s.nom });
      case "adminRetire":
        return t("chat.sysAdminRetire", { acteur: s.acteur, nom: s.nom });
      case "adminAuto":
        return t("chat.sysAdminAuto", { nom: s.nom });
      default:
        return "";
    }
  }

  function marquerLu(conversationId, dateIso) {
    if (!dateIso) return;
    setLus((precedent) => {
      if (precedent[conversationId] && new Date(precedent[conversationId]) >= new Date(dateIso)) return precedent;
      const suivant = { ...precedent, [conversationId]: dateIso };
      ecrireLus(suivant); // la cloche des notifications se met à jour
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
      ecrireLus(initial);
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
        if (data.permissions) setPermissions(data.permissions);
        // Arrivée depuis une notification (cloche ou téléphone) : /moi/discussion?c=<id> ouvre cette conversation.
        const cible = new URLSearchParams(window.location.search).get("c");
        if (cible && !ouvertDepuisUrl.current) {
          const c = (data.conversations || []).find((x) => x.id === cible);
          if (c) {
            ouvertDepuisUrl.current = true;
            ouvrirConversation(c);
            window.history.replaceState(null, "", "/moi/discussion");
          }
        }
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
    if (messagesConnusRef.current.conversationId !== conversationId) {
      messagesConnusRef.current = { conversationId, ids: new Set(nouveaux.map((x) => x.id)) };
    }
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
  function choisirQuartEchange(q) {
    setQuartEchange(q);
    setEchDebut(q.heure_debut.slice(0, 5));
    setEchFin(q.heure_fin.slice(0, 5));
    setEchangeErreur("");
  }

  async function ouvrirEchange() {
    setMenuPlus(false);
    setQuartEchange(null);
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

  async function proposerEchange(quart, autreEmployeId, debut, fin) {
    if (echangeBusy) return;
    const erreur = erreurPlage(debut, fin, quart);
    if (erreur && !(debut === quart.heure_debut.slice(0, 5) && fin === quart.heure_fin.slice(0, 5))) {
      setEchangeErreur(erreur);
      return;
    }
    setEchangeBusy(true);
    setEchangeErreur("");
    try {
      const res = await employeFetch("/api/employe-app/demandes/echanges", {
        method: "POST",
        body: JSON.stringify({ quartId: quart.id, avecEmployeId: autreEmployeId, heureDebut: debut, heureFin: fin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEchangeErreur(data.error || t("chat.echangeErreur"));
        setEchangeBusy(false);
        return;
      }
      const partiel = debut !== quart.heure_debut.slice(0, 5) || fin !== quart.heure_fin.slice(0, 5);
      const contenu = t(partiel ? "chat.echangePartieMessage" : "chat.echangeMessage", {
        date: new Date(quart.date).toLocaleDateString(localeDate(langue)),
        debut: partiel ? debut : quart.heure_debut.slice(0, 5),
        fin: partiel ? fin : quart.heure_fin.slice(0, 5),
      });
      await employeFetch("/api/employe-app/chat/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId: activeId, contenu, demandeEchangeId: data.demande?.id }),
      });
      setEchangeOuvert(false);
      chargerMessages(activeId);
      chargerConversations({ silencieux: true });
    } catch {
      setEchangeErreur(t("chat.echangeErreur"));
    }
    setEchangeBusy(false);
  }

  async function repondreEchange(echangeId, accepte) {
    try {
      await employeFetch(`/api/employe-app/demandes/echanges/${echangeId}/repondre`, {
        method: "POST",
        body: JSON.stringify({ accepte }),
      });
    } catch {}
    chargerMessages(activeId);
  }

  // Carte d'une proposition d'échange de quart, dans la bulle du message.
  function carteEchange(e) {
    if (!e) return null;
    const quart = e.quart;
    return (
      <div className="chat-echange" onClick={(ev) => ev.stopPropagation()}>
        {quart && (
          <div>
            {new Date(quart.date).toLocaleDateString(localeDate(langue))} ·{" "}
            {e.heureDebut && e.heureFin ? `${e.heureDebut}–${e.heureFin}` : `${quart.heure_debut?.slice(0, 5)}–${quart.heure_fin?.slice(0, 5)}`}
            {e.heureDebut && e.heureFin && (
              <div style={{ opacity: 0.75 }}>
                {t("demandes.partieDuQuart", { debut: quart.heure_debut?.slice(0, 5), fin: quart.heure_fin?.slice(0, 5) })}
              </div>
            )}
          </div>
        )}
        <div style={{ opacity: 0.85 }}>
          <Pictos texte={badgeEchange({ role: e.role, statutEmploye: e.statutEmploye, statutAdmin: e.statutAdmin }, t)} />
        </div>
        {e.role === "receveur" && e.statutEmploye === "en_attente" && (
          <div className="chat-echange-actions">
            <button type="button" className="admin-icon-btn" onClick={() => repondreEchange(e.id, true)}>
              {t("demandes.accepter")}
            </button>
            <button type="button" className="admin-icon-btn danger" onClick={() => repondreEchange(e.id, false)}>
              {t("demandes.refuser")}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Même message à plusieurs collègues, chacun dans sa propre conversation (pas de groupe).
  async function envoyerMulti(e) {
    e.preventDefault();
    if (!multiTexte.trim() || multiIds.size === 0) return;
    setMultiBusy(true);
    setMultiMsg(null);
    try {
      const res = await employeFetch("/api/employe-app/chat/conversations/multi", {
        method: "POST",
        body: JSON.stringify({ employeIds: [...multiIds], contenu: multiTexte.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMultiMsg({ type: "err", text: data.error || t("chat.erreurMulti") });
      } else {
        setMultiMsg({ type: "ok", text: t(data.refuses > 0 ? "chat.multiEnvoyePartiel" : "chat.multiEnvoye", { n: data.envoyes }) });
        setMultiTexte("");
        setMultiIds(new Set());
        chargerConversations({ silencieux: true });
      }
    } catch {
      setMultiMsg({ type: "err", text: t("chat.erreurMulti") });
    }
    setMultiBusy(false);
  }

  // Supprime la conversation ouverte « pour moi » (l'autre personne et le propriétaire gardent tout).
  // Sourdine : plus de notification des nouveaux messages de cette conversation (elle reste dans la liste).
  async function basculerSourdine() {
    if (!conversationActive) return;
    const sourdine = !conversationActive.sourdine;
    setConversations((cur) => cur.map((c) => (c.id === conversationActive.id ? { ...c, sourdine } : c)));
    try {
      const res = await employeFetch("/api/employe-app/chat/conversations/sourdine", { method: "POST", body: JSON.stringify({ conversationId: conversationActive.id, sourdine }) });
      if (!res.ok) throw new Error("sourdine");
    } catch {
      setConversations((cur) => cur.map((c) => (c.id === conversationActive.id ? { ...c, sourdine: !sourdine } : c)));
      setErreur(t("chat.sourdineErreur"));
    }
  }

  async function supprimerConversation() {
    if (!activeId || suppressionBusy) return;
    setSuppressionBusy(true);
    setSuppressionErreur("");
    try {
      // Un groupe se quitte pour de vrai (les autres le voient) ; une discussion directe se supprime seulement de mon côté.
      const res = estGroupeActif
        ? await employeFetch("/api/employe-app/chat/conversations/groupe/gerer", { method: "POST", body: JSON.stringify({ conversationId: activeId, action: "quitter" }) })
        : await employeFetch("/api/employe-app/chat/conversations/masquer", { method: "POST", body: JSON.stringify({ conversationId: activeId }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSuppressionErreur(data.error || t(estGroupeActif ? "chat.quitterErreur" : "chat.supprimerErreur"));
      } else {
        setSuppressionOuverte(false);
        setActiveId(null);
        setMessages([]);
        setVue("liste");
        chargerConversations();
      }
    } catch {
      setSuppressionErreur(t(estGroupeActif ? "chat.quitterErreur" : "chat.supprimerErreur"));
    }
    setSuppressionBusy(false);
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
    return <Squelettes nb={5} haut={66} />;
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
          {conversationsVisibles.map((c, i) => {
            // Non lu : un message d'un AUTRE, plus récent que le dernier que j'ai vu.
            const nonLu =
              !!c.dernierMessageDate &&
              !c.dernierDeMoi &&
              (!lus[c.id] || new Date(c.dernierMessageDate) > new Date(lus[c.id]));
            return (
              <button
                key={c.id}
                type="button"
                style={{ "--n": Math.min(i, 7) }}
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
              {estGroupeActif ? (
                <button type="button" className="chat-titre-groupe" onClick={() => { setGestionErreur(""); setRetraitConfirmeId(null); setMembresOuvert(true); }}>
                  <strong>{activeTitre}</strong>
                  {membres && <small>{t("chat.nbMembres", { n: membres.length })}</small>}
                </button>
              ) : (
                <strong style={{ fontSize: "14px" }}>{activeTitre}</strong>
              )}
              {conversationActive && (
                <button type="button" className="admin-icon-btn" style={{ marginLeft: "auto" }} onClick={basculerSourdine}>
                  {conversationActive.sourdine ? (
                    <>
                      <IconClocheBarree className="gozly-icon" /> {t("chat.sourdineOff")}
                    </>
                  ) : (
                    t("chat.sourdine")
                  )}
                </button>
              )}
              {conversationActive && conversationActive.type !== "equipe" && (
                <button
                  type="button"
                  className="admin-icon-btn danger"
                  onClick={() => {
                    setSuppressionErreur("");
                    setSuppressionOuverte(true);
                  }}
                >
                  {t(estGroupeActif ? "chat.quitter" : "chat.supprimer")}
                </button>
              )}
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
                // Un message déjà là à l'ouverture ne joue pas l'animation ; les miens seulement tant qu'ils sont provisoires (tmp-).
                const animeeArrivee = (m) => (m.deMoi ? String(m.id).startsWith("tmp-") : !messagesConnusRef.current.ids.has(m.id));
                return (
                  <>
                    {messages.map((m) =>
                      m.systeme ? (
                        <div key={m.id} className="chat-systeme">
                          {texteSysteme(m.systeme)}
                        </div>
                      ) : (
                      <div
                        key={m.id}
                        className={animeeArrivee(m) ? `chat-bulle-nouvelle${m.deMoi ? " mine" : ""}` : undefined}
                        style={{ display: "flex", flexDirection: "column" }}
                      >
                        <BulleMessage
                          m={{
                            id: m.id,
                            auteur: m.deMoi ? t("chat.toi") : m.expediteurNom,
                            avatar: m.deMoi ? null : m.expediteurAvatar,
                            nomAvatar: m.expediteurNom,
                            mine: m.deMoi,
                            contenu: m.contenu,
                            reponse: m.reponse ? { auteur: m.reponse.deMoi ? t("chat.toi") : m.reponse.auteur, contenu: m.reponse.contenu } : null,
                            reactions: m.reactions || [],
                            tmp: String(m.id).startsWith("tmp-"),
                            extra: carteEchange(m.echange),
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
                      )
                    )}
                    <IndicateurEcriture ecrivent={presence.ecrivent} avatars={presence.ecriventAvatars} textes={textesChat} />
                  </>
                );
              })()}
            </div>
            {estGroupeActif && membres && membres.length === 1 && <p className="chat-empty" style={{ padding: "6px 14px" }}>{t("chat.seulDansGroupe")}</p>}
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
            {conversationActive?.bloquee && (
              <div className="chat-compose">
                <p className="chat-empty" style={{ padding: 0, flex: 1 }}>{t("chat.conversationDesactivee")}</p>
              </div>
            )}
            <form className="chat-compose" style={conversationActive?.bloquee ? { display: "none" } : undefined} onSubmit={handleEnvoyer}>
              {menuPlus && !texte && autreEmployeIdActif && (
                <>
                  <div className="chat-plus-fond" onClick={() => setMenuPlus(false)} />
                  <div className="chat-plus-menu">
                    <button type="button" className="chat-plus-item" onClick={ouvrirEchange}>
                      {t("chat.menuEchange")}
                    </button>
                    {permissions.rappels && (
                      <button
                        type="button"
                        className="chat-plus-item"
                        onClick={() => {
                          setMenuPlus(false);
                          setRappelOuvert({ fixes: [autreEmployeIdActif], nom: activeTitre });
                        }}
                      >
                        {t("rap.menuDiscussion")}
                      </button>
                    )}
                  </div>
                </>
              )}
              {autreEmployeIdActif && (
              <button
                type="button"
                className={`chat-plus-btn${texte ? " reduit" : ""}${menuPlus && !texte ? " ouvert" : ""}`}
                onClick={() => setMenuPlus((v) => !v)}
                aria-label={t("chat.plus")}
                tabIndex={texte ? -1 : 0}
              >
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
            {quartEchange ? (
              <div>
                <div className="admin-row-title" style={{ marginBottom: "6px" }}>
                  {new Date(quartEchange.date).toLocaleDateString(localeDate(langue))} · {quartEchange.heure_debut.slice(0, 5)}–{quartEchange.heure_fin.slice(0, 5)}
                </div>
                <div className="field">
                  <label>{t("chat.echangeHeures")}</label>
                  <div className="field-row">
                    <div className="field">
                      <label>{t("chat.echangeDe")}</label>
                      <input
                        type="time"
                        value={echDebut}
                        min={quartEchange.heure_debut.slice(0, 5)}
                        max={quartEchange.heure_fin.slice(0, 5)}
                        onChange={(e) => setEchDebut(e.target.value)}
                        onBlur={() => setEchDebut((v) => dansLeQuart(v, quartEchange))}
                      />
                    </div>
                    <div className="field">
                      <label>{t("chat.echangeA")}</label>
                      <input
                        type="time"
                        value={echFin}
                        min={quartEchange.heure_debut.slice(0, 5)}
                        max={quartEchange.heure_fin.slice(0, 5)}
                        onChange={(e) => setEchFin(e.target.value)}
                        onBlur={() => setEchFin((v) => dansLeQuart(v, quartEchange))}
                      />
                    </div>
                  </div>
                </div>
                <button type="button" className="submit-btn" disabled={echangeBusy || !echDebut || !echFin} onClick={() => proposerEchange(quartEchange, autreEmployeIdActif, echDebut, echFin)}>
                  {echangeBusy ? t("demandes.envoi") : t("demandes.proposer")}
                </button>{" "}
                <button type="button" className="admin-icon-btn" onClick={() => setQuartEchange(null)}>
                  {t("chat.echangeChangerQuart")}
                </button>
              </div>
            ) : mesQuarts === null ? (
              <ChargementAnimation />
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
                    onClick={() => choisirQuartEchange(q)}
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
              {permissions.groupes && (
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
              )}
              {permissions.rappels && (
                <button
                  type="button"
                  className="dash-nav-item"
                  onClick={() => {
                    setMenuNouveau(false);
                    setRappelOuvert({ fixes: null, nom: "" });
                  }}
                >
                  <IconCloche className="gozly-icon" /> {t("rap.menu")}
                </button>
              )}
              {permissions.multi && (
                <button
                  type="button"
                  className="dash-nav-item"
                  onClick={() => {
                    setMenuNouveau(false);
                    setMultiMsg(null);
                    setMultiOuvert(true);
                  }}
                >
                  <IconProfils className="gozly-icon" /> {t("chat.plusieurs")}
                </button>
              )}
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

      {membresOuvert && estGroupeActif && (
        <div className="modal-overlay" onClick={() => setMembresOuvert(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("chat.membresTitre")}</h3>
              <button className="admin-icon-btn" onClick={() => setMembresOuvert(false)}>
                {t("nav.fermer")}
              </button>
            </div>
            {gestionErreur && <p className="settings-msg err">{gestionErreur}</p>}
            {membres === null ? (
              <ChargementAnimation />
            ) : (
              <>
                <div>
                  {membres.map((mb) => (
                    <div className="chat-membre-row" key={mb.type + mb.id}>
                      <Avatar valeur={mb.avatar} nom={mb.nom} taille={34} />
                      <span className="chat-membre-nom">
                        {mb.nom}
                        {mb.moi ? ` (${String(t("chat.toi")).toLowerCase()})` : ""}
                      </span>
                      {mb.estAdmin && <span className="chat-membre-badge">{t("chat.admin")}</span>}
                      {suisAdmin && !mb.moi && mb.type === "employe" && (
                        <span className="chat-membre-actions">
                          <button type="button" className="admin-icon-btn" disabled={gestionBusy} onClick={() => gererGroupe({ action: "admin", employeId: mb.id, admin: !mb.estAdmin })}>
                            {t(mb.estAdmin ? "chat.retirerAdmin" : "chat.nommerAdmin")}
                          </button>
                          <button
                            type="button"
                            className="admin-icon-btn danger"
                            disabled={gestionBusy}
                            onClick={() => {
                              if (retraitConfirmeId === mb.id) {
                                setRetraitConfirmeId(null);
                                gererGroupe({ action: "retirer", employeId: mb.id });
                              } else setRetraitConfirmeId(mb.id);
                            }}
                          >
                            {t(retraitConfirmeId === mb.id ? "chat.confirmerRetrait" : "chat.retirer")}
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="section-hint" style={{ margin: "14px 0 6px" }}>
                  {t("chat.ajouterMembres")}
                </p>
                {(() => {
                  const dedans = new Set(membres.filter((x) => x.type === "employe").map((x) => x.id));
                  const aAjouter = tous.filter((c) => !dedans.has(c.id));
                  if (aAjouter.length === 0) return <p className="chat-empty">{t("chat.tousDansGroupe")}</p>;
                  return (
                    <>
                      <div className="moi-picker-list">
                        {aAjouter.map((c) => (
                          <label className="moi-picker-row" key={c.id} style={{ cursor: "pointer" }}>
                            <span>{c.nom}</span>
                            <input
                              type="checkbox"
                              checked={ajoutIds.has(c.id)}
                              onChange={() =>
                                setAjoutIds((prev) => {
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
                      <button type="button" className="submit-btn" style={{ width: "100%", marginTop: "10px" }} disabled={gestionBusy || ajoutIds.size === 0} onClick={ajouterAuGroupe}>
                        {t("chat.ajouterConfirmer")}
                      </button>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {suppressionOuverte && (
        <div className="modal-overlay" onClick={() => !suppressionBusy && setSuppressionOuverte(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t(estGroupeActif ? "chat.quitterTitre" : "chat.supprimerTitre")}</h3>
            </div>
            <p className="panel-hint">
              {estGroupeActif
                ? membres && membres.length === 1
                  ? t("chat.quitterTexteDernier")
                  : t("chat.quitterTexte") + (suisAdmin ? " " + t("chat.quitterTexteAdmin") : "")
                : t("chat.supprimerTexte")}
            </p>
            {suppressionErreur && <p className="settings-msg err">{suppressionErreur}</p>}
            <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
              <button type="button" className="admin-icon-btn" style={{ flex: 1 }} disabled={suppressionBusy} onClick={() => setSuppressionOuverte(false)}>
                {t("nav.fermer")}
              </button>
              <button type="button" className="submit-btn" style={{ flex: 1 }} disabled={suppressionBusy} onClick={supprimerConversation}>
                {t(estGroupeActif ? "chat.quitterOui" : "chat.supprimerOui")}
              </button>
            </div>
          </div>
        </div>
      )}

      {rappelOuvert && <RappelEmployeModal fixes={rappelOuvert.fixes} nomFixe={rappelOuvert.nom} tous={tous} onClose={() => setRappelOuvert(null)} />}

      {multiOuvert && (
        <div className="modal-overlay" onClick={() => setMultiOuvert(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("chat.multiTitre")}</h3>
              <button className="admin-icon-btn" onClick={() => setMultiOuvert(false)}>
                {t("nav.fermer")}
              </button>
            </div>
            <p className="panel-hint">{t("chat.multiHint")}</p>
            <form onSubmit={envoyerMulti}>
              {tous.length === 0 ? (
                <p className="chat-empty">{t("chat.aucunCollegue")}</p>
              ) : (
                <div className="moi-picker-list">
                  {tous.map((c) => (
                    <label className="moi-picker-row" key={c.id} style={{ cursor: "pointer" }}>
                      <span>{c.nom}</span>
                      <input
                        type="checkbox"
                        checked={multiIds.has(c.id)}
                        onChange={() =>
                          setMultiIds((prev) => {
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
              <div className="field" style={{ marginTop: "10px" }}>
                <textarea value={multiTexte} onChange={(e) => setMultiTexte(e.target.value)} placeholder={t("chat.multiPlaceholder")} rows={3} maxLength={2000} />
              </div>
              {multiMsg && <p className={`settings-msg ${multiMsg.type}`}>{multiMsg.text}</p>}
              <button type="submit" className="submit-btn" style={{ width: "100%" }} disabled={multiBusy || !multiTexte.trim() || multiIds.size === 0}>
                {t("chat.multiEnvoyer")}
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
