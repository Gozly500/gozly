"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/components/LangProvider";
import { LANG_COOKIE } from "@/lib/i18n/site";
import { IconGlobe } from "@/components/icons/Pictogrammes";
import { supabase } from "@/lib/supabaseClient";

// Bascule FR <-> EN : on écrit le cookie puis on redemande les composants serveur.
export function useChangerLangue() {
  const router = useRouter();
  const { lang } = useT();
  const autre = lang === "fr" ? "en" : "fr";
  return function changer() {
    document.cookie = `${LANG_COOKIE}=${autre}; path=/; max-age=31536000; samesite=lax`;
    // Connecté : la langue du compte suit (sinon le dashboard la remettrait à l'ancienne valeur).
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session) return supabase.from("profils").update({ langue: autre }).eq("id", session.user.id);
      })
      .catch(() => {});
    router.refresh();
  };
}

// Pastille à côté de la barre de navigation : globe + langue vers laquelle on bascule.
export default function LangSwitch() {
  const { t } = useT();
  const changer = useChangerLangue();
  return (
    <button type="button" className="lang-bubble" onClick={changer} title={t("lang.changer")} aria-label={t("lang.changer")}>
      <IconGlobe className="gozly-icon" />
      <span>{t("lang.autre")}</span>
    </button>
  );
}

// Lien discret dans le pied de page.
export function LangFooterLink() {
  const { t, lang } = useT();
  const changer = useChangerLangue();
  return (
    <button type="button" className="footer-lang" onClick={changer}>
      {lang === "fr" ? "English" : "Français"}
    </button>
  );
}
