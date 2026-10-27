"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import PopupMiseAJour from "@/components/PopupMiseAJour";

// Pop-ups d'ouverture du tableau de bord et de l'app Gestion (écrits dans le panneau admin Gozly) : une seule fois par utilisateur.
export default function PopupsGestion() {
  const { t, lang } = useT();
  const [popups, setPopups] = useState([]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch("/api/popups", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        if (res.ok && !ignore) setPopups((await res.json()).popups || []);
      } catch {}
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function vu(id) {
    setPopups((l) => l.filter((p) => p.id !== id));
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await fetch("/api/popups", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ id }),
      });
    } catch {}
  }

  return <PopupMiseAJour popups={popups} langue={lang} onVu={vu} bouton={t("Compris")} etiquette={t("Nouveauté")} compteur={(n) => t("{n} autres ensuite", { n: n - 1 })} />;
}
