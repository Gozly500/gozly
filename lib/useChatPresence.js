"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const VIDE = { ecrivent: [], vus: [] };

// "En train d'écrire" et "Vu" d'une conversation ouverte.
// appeler(corps) : envoie { conversationId, ecrit?, lu? } à la bonne route et renvoie sa réponse JSON.
// Tant que la conversation est visible : on se déclare "en train de regarder" et on lit l'état
// des autres toutes les 3 secondes.
export function useChatPresence(conversationId, appeler) {
  const [etat, setEtat] = useState(VIDE);
  const appelerRef = useRef(appeler);
  appelerRef.current = appeler;
  const dernierSignalRef = useRef(0);

  const demander = useCallback(
    async (corps) => {
      if (!conversationId) return;
      try {
        const data = await appelerRef.current({ conversationId, ...corps });
        if (data) setEtat({ ecrivent: data.ecrivent || [], vus: data.vus || [] });
      } catch {}
    },
    [conversationId]
  );

  useEffect(() => {
    setEtat(VIDE);
    dernierSignalRef.current = 0;
    if (!conversationId) return;
    const tick = () => {
      if (document.visibilityState === "visible") demander({ lu: true });
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [conversationId, demander]);

  // À appeler à chaque frappe : n'envoie qu'un signal toutes les 3 secondes.
  const signalerEcriture = useCallback(() => {
    const maintenant = Date.now();
    if (maintenant - dernierSignalRef.current < 3000) return;
    dernierSignalRef.current = maintenant;
    demander({ ecrit: true });
  }, [demander]);

  const arreterEcriture = useCallback(() => {
    if (dernierSignalRef.current === 0) return;
    dernierSignalRef.current = 0;
    demander({ ecrit: false });
  }, [demander]);

  return { ...etat, signalerEcriture, arreterEcriture };
}
