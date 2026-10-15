"use client";

import { createContext, useContext, useMemo } from "react";
import { createT } from "@/lib/i18n/site";

const LangContext = createContext({ lang: "fr", t: createT("fr") });

// Fournit la langue (lue côté serveur dans le cookie) aux composants client du site public.
export function LangProvider({ lang, children }) {
  const value = useMemo(() => ({ lang, t: createT(lang) }), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT() {
  return useContext(LangContext);
}

// Texte avec **gras** (on évite dangerouslySetInnerHTML) : "a **b** c" -> a <strong>b</strong> c.
export function Rich({ text }) {
  return text.split("**").map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}
