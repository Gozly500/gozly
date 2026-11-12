"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import { IconFlecheDroite } from "@/components/icons/Pictogrammes";

// Boutons du haut de l'accueil :
//  - connecté : un seul bouton vers le tableau de bord ;
//  - pas connecté : « Démarrer » (création de compte) et « Autre service » (pas encore disponible).
export default function HeroBoutons() {
  const { t } = useT();
  const [connecte, setConnecte] = useState(false);
  const [bientot, setBientot] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setConnecte(!!data?.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => setConnecte(!!session));
    return () => listener.subscription.unsubscribe();
  }, []);

  function autreService() {
    setBientot(true);
    setTimeout(() => setBientot(false), 3500);
  }

  if (connecte) {
    return (
      <div className="hero-ctas">
        <Link href="/dashboard" className="btn-pill-dark">
          {t("nav.dashboard")} <IconFlecheDroite className="gozly-icon-inline" />
        </Link>
      </div>
    );
  }

  return (
    <div className="hero-ctas">
      <Link href="/inscription" className="btn-pill-dark">
        {t("home.cta.demarrer")} <IconFlecheDroite className="gozly-icon-inline" />
      </Link>
      <button type="button" className="btn-pill-glass" onClick={autreService}>
        {t("home.cta.autre")}
      </button>
      {bientot && (
        <div className="nav-toast" role="status">
          {t("home.cta.bientot")}
        </div>
      )}
    </div>
  );
}
