"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_LANGUE, LANGUE_STORAGE_KEY_MOI, isValidLangue, traduire } from "@/lib/i18n/moi";

const LangueContext = createContext(null);

// Enrobe tout /moi/* (voir app/moi/layout.js) - la préférence de langue est
// mémorisée sur l'appareil, comme le thème (ParametresApparence.jsx).
export function LangueProvider({ children }) {
  const [langue, setLangueState] = useState(DEFAULT_LANGUE);

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(LANGUE_STORAGE_KEY_MOI);
      if (isValidLangue(cached)) setLangueState(cached);
    } catch {}
  }, []);

  function setLangue(id) {
    if (!isValidLangue(id)) return;
    setLangueState(id);
    try {
      window.localStorage.setItem(LANGUE_STORAGE_KEY_MOI, id);
    } catch {}
  }

  const t = (cle, params) => traduire(langue, cle, params);

  return <LangueContext.Provider value={{ langue, setLangue, t }}>{children}</LangueContext.Provider>;
}

export function useLangue() {
  const ctx = useContext(LangueContext);
  if (!ctx) {
    return { langue: DEFAULT_LANGUE, setLangue: () => {}, t: (cle, params) => traduire(DEFAULT_LANGUE, cle, params) };
  }
  return ctx;
}
