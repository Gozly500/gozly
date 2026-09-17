"use client";

import { useEffect } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY_MOI, isValidTheme } from "@/lib/themes";

// Rendu par app/moi/layout.js, qui persiste tant qu'on reste dans /moi -
// contrairement à MoiShell qui se remonte à chaque changement de page
// (chaque route a son propre page.js qui l'instancie), donc le thème
// posé ici ne risque pas d'être effacé par une navigation entre-temps.
export default function MoiThemeAppliqueur() {
  useEffect(() => {
    let theme = DEFAULT_THEME;
    try {
      const cached = window.localStorage.getItem(THEME_STORAGE_KEY_MOI);
      if (isValidTheme(cached)) theme = cached;
    } catch {}
    document.documentElement.dataset.theme = theme;

    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, []);

  return null;
}
