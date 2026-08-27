"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_THEME, THEME_STORAGE_KEY, isValidTheme } from "@/lib/themes";

export default function DashboardLayout({ children }) {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    let cached = null;
    try {
      cached = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {}
    if (isValidTheme(cached)) setTheme(cached);

    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;

      const { data } = await supabase
        .from("profils")
        .select("theme")
        .eq("id", session.user.id)
        .maybeSingle();

      if (ignore || !isValidTheme(data?.theme)) return;

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
    };
  }, [theme]);

  return children;
}
