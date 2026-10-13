"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { employeFetch } from "@/lib/employeAuth";

// Annonces du propriétaire + rappels destinés à l'employé (voir supabase/annonces.sql et rappels.sql), chargés une
// seule fois pour toute l'app /moi : la bannière du haut, la cloche de l'en-tête (pastille) et la page « Annonces et
// rappels » lisent la même liste. « OK » les marque comme vues sur cet appareil seulement.
const CLE_MASQUEES = "gozly_annonces_masquees";
const INTERVALLE_MS = 60000;

const AnnoncesContexte = createContext({ items: [], masquees: new Set(), nonVues: 0, masquer: () => {} });

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

  const charger = useCallback(async () => {
    try {
      const [resAnnonces, resRappels] = await Promise.all([employeFetch("/api/employe-app/annonces"), employeFetch("/api/employe-app/rappels")]);
      const annonces = resAnnonces.ok ? (await resAnnonces.json()).annonces || [] : [];
      const rappels = resRappels.ok ? (await resRappels.json()).recus || [] : [];
      setItems([...annonces, ...rappels.map((r) => ({ ...r, rappelDe: r.auteur }))]);
    } catch {}
  }, []);

  useEffect(() => {
    setMasquees(lireMasquees());
    charger();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") charger();
    }, INTERVALLE_MS);
    return () => clearInterval(id);
  }, [charger]);

  function masquer(id) {
    const suivant = new Set(masquees);
    suivant.add(id);
    setMasquees(suivant);
    try {
      // On ne garde que les éléments encore en cours : la liste ne grossit pas indéfiniment.
      const encore = new Set(items.map((a) => a.id));
      window.localStorage.setItem(CLE_MASQUEES, JSON.stringify([...suivant].filter((x) => encore.has(x))));
    } catch {}
  }

  const nonVues = items.filter((a) => !masquees.has(a.id)).length;

  return <AnnoncesContexte.Provider value={{ items, masquees, nonVues, masquer }}>{children}</AnnoncesContexte.Provider>;
}
