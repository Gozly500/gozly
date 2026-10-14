"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";
import { EVENEMENT_LUS, conversationNonLue, ecrireLus, lireLus, lusInitialises } from "@/lib/chatLus";

// Annonces du propriétaire + rappels destinés à l'employé (voir supabase/annonces.sql et rappels.sql), chargés une
// seule fois pour toute l'app /moi : la bannière du haut, la cloche de l'en-tête (pastille) et la page « Annonces et
// rappels » lisent la même liste. « OK » les marque comme vues sur cet appareil seulement.
const CLE_MASQUEES = "gozly_annonces_masquees";
const INTERVALLE_MS = 30000;

const AnnoncesContexte = createContext({ items: [], messagesNonLus: [], masquees: new Set(), nonVues: 0, masquer: () => {} });

export function useAnnonces() {
  return useContext(AnnoncesContexte);
}

function lireMasquees() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(CLE_MASQUEES) || "[]"));
  } catch {
    return new Set();
  }
}

export function AnnoncesProvider({ children }) {
  const [items, setItems] = useState([]);
  const [masquees, setMasquees] = useState(() => new Set());
  const [conversations, setConversations] = useState([]);
  const [lus, setLus] = useState({});

  const charger = useCallback(async () => {
    try {
      const [resAnnonces, resRappels, resConversations] = await Promise.all([
        employeFetch("/api/employe-app/annonces"),
        employeFetch("/api/employe-app/rappels"),
        employeFetch("/api/employe-app/chat/conversations"),
      ]);
      if (resConversations.ok) {
        const liste = (await resConversations.json()).conversations || [];
        // Première fois sur cet appareil : rien n'est « non lu », on part de l'état actuel (comme la page Discussion).
        if (!lusInitialises()) {
          const initial = {};
          for (const c of liste) if (c.dernierMessageDate) initial[c.id] = c.dernierMessageDate;
          ecrireLus(initial);
        }
        setConversations(liste);
        setLus(lireLus());
      }
      const annonces = resAnnonces.ok ? (await resAnnonces.json()).annonces || [] : [];
      const rappels = resRappels.ok ? (await resRappels.json()).recus || [] : [];
      setItems([...annonces, ...rappels.map((r) => ({ ...r, rappel: true, rappelDe: r.auteur }))]); // rappelDe vide = rappel anonyme
    } catch {}
  }, []);

  useEffect(() => {
    setMasquees(lireMasquees());
    setLus(lireLus());
    // Une conversation ouverte dans la page Discussion est marquée lue : la cloche se met à jour tout de suite.
    const surLus = () => setLus(lireLus());
    window.addEventListener(EVENEMENT_LUS, surLus);
    charger();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") charger();
    }, INTERVALLE_MS);
    return () => {
      clearInterval(id);
      window.removeEventListener(EVENEMENT_LUS, surLus);
    };
  }, [charger]);

  function masquer(id) {
    // Une annonce (ni rappel ni appel de remplaçant) : le propriétaire voit qui l'a lue.
    const item = items.find((a) => a.id === id);
    if (item && !item.rappel && !item.remplacement) {
      employeFetch("/api/employe-app/annonces/lu", { method: "POST", body: JSON.stringify({ annonceId: id }) }).catch(() => {});
    }
    const suivant = new Set(masquees);
    suivant.add(id);
    setMasquees(suivant);
    try {
      // On ne garde que les éléments encore en cours : la liste ne grossit pas indéfiniment.
      const encore = new Set(items.map((a) => a.id));
      window.localStorage.setItem(CLE_MASQUEES, JSON.stringify([...suivant].filter((x) => encore.has(x))));
    } catch {}
  }

  // Conversations avec un message non lu, la plus récente d'abord.
  const messagesNonLus = conversations
    .filter((c) => conversationNonLue(c, lus) && !c.sourdine)
    .sort((a, b) => new Date(b.dernierMessageDate) - new Date(a.dernierMessageDate));

  const nonVues = items.filter((a) => !masquees.has(a.id)).length + messagesNonLus.length;

  return <AnnoncesContexte.Provider value={{ items, messagesNonLus, masquees, nonVues, masquer }}>{children}</AnnoncesContexte.Provider>;
}
