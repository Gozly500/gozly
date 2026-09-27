"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEME_ACCENT_STORAGE_KEY, isValidTheme, isValidAccent, appliquerAccent } from "@/lib/themes";

export default function DashboardLayout({ children }) {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  // ?apercu=clair : teste le thème Clair (en construction) sans l'enregistrer ni l'exposer aux autres.
  const apercuClair = useRef(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("apercu") === "clair") {
      apercuClair.current = true;
      setTheme("clair");
    }

    let cached = null;
    try {
      cached = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {}
    if (!apercuClair.current && isValidTheme(cached)) setTheme(cached);

    try {
      const accentCache = window.localStorage.getItem(THEME_ACCENT_STORAGE_KEY);
      if (isValidAccent(accentCache)) appliquerAccent(accentCache);
    } catch {}

    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;

      const { data } = await supabase
        .from("profils")
        .select("theme")
        .eq("id", session.user.id)
        .maybeSingle();

      // Colonne à part et requête à part : si elle n'existe pas encore (SQL pas exécuté),
      // le thème ci-dessous se charge quand même.
      supabase
        .from("profils")
        .select("theme_accent")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(({ data: acc, error: accErr }) => {
          if (ignore || accErr) return;
          const id = acc?.theme_accent || "gozly";
          appliquerAccent(id);
          try {
            window.localStorage.setItem(THEME_ACCENT_STORAGE_KEY, id);
          } catch {}
        });

      if (ignore || apercuClair.current || !isValidTheme(data?.theme)) return;

      setTheme(data.theme);
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, data.theme);
      } catch {}
    });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
      delete document.documentElement.dataset.accent;
    };
  }, [theme]);

  return children;
}
