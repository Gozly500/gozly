"use client";

import { useEffect } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY_KIOSQUE, THEME_ACCENT_STORAGE_KEY_KIOSQUE, isValidTheme, appliquerAccent } from "@/lib/themes";

// Thème de la tablette kiosque : mémorisé sur la tablette (réglages du kiosque), indépendant du thème
// du compte dans le dashboard. Rendu par app/kiosque/layout.js, qui persiste d'une page à l'autre.
export default function KiosqueThemeAppliqueur() {
  useEffect(() => {
    let theme = DEFAULT_THEME;
    try {
      const cached = window.localStorage.getItem(THEME_STORAGE_KEY_KIOSQUE);
      if (isValidTheme(cached)) theme = cached;
    } catch {}
    document.documentElement.dataset.theme = theme;
    try {
      appliquerAccent(window.localStorage.getItem(THEME_ACCENT_STORAGE_KEY_KIOSQUE));
    } catch {}

    return () => {
      delete document.documentElement.dataset.theme;
      delete document.documentElement.dataset.accent;
    };
  }, []);

  return null;
}
