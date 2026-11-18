"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import { IconFlecheDroite } from "@/components/icons/Pictogrammes";

// Boutons du haut de l'accueil :
//  - connecté : un seul bouton vers le tableau de bord ;
//  - pas connecté : « Démarrer » (création de compte) et « Démo » (page /demo : entreprise fictive à essayer).
export default function HeroBoutons() {
  const { t } = useT();
  const [connecte, setConnecte] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setConnecte(!!data?.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => setConnecte(!!session));
    return () => listener.subscription.unsubscribe();
  }, []);

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
      <Link href="/demo" className="btn-pill-glass">
        {t("home.cta.autre")}
      </Link>
    </div>
  );
}
