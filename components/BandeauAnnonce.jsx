"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";
import Gozyx from "@/components/Gozyx";

const CLE_VUE = "gozly-annonce-vue";
const JOURS_VISIBLE = 21;

// Bandeau « Nouveau sur Gozly » en haut du tableau de bord : la dernière annonce publique du site (page /annonces).
// Il disparaît quand on le ferme (mémorisé sur cet appareil) ou après 3 semaines.
export default function BandeauAnnonce() {
  const { t } = useT();
  const [annonce, setAnnonce] = useState(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/annonces-site?limit=1", { cache: "no-store" });
        const json = await res.json();
        const a = json.annonces?.[0];
        if (!a || ignore) return;
        if (Date.now() - new Date(a.publie_le).getTime() > JOURS_VISIBLE * 24 * 3600 * 1000) return;
        let vue = null;
        try {
          vue = localStorage.getItem(CLE_VUE);
        } catch {}
        if (vue !== a.id) setAnnonce(a);
      } catch {}
    })();
    return () => {
      ignore = true;
    };
  }, []);

  if (!annonce) return null;

  function fermer() {
    try {
      localStorage.setItem(CLE_VUE, annonce.id);
    } catch {}
    setAnnonce(null);
  }

  return (
    <div className="dash-annonce-banner">
      <Gozyx humeur="content" taille={44} />
      <div className="dash-annonce-texte">
        <small>{t("Nouveau sur Gozly")}</small>
        <strong>{annonce.titre}</strong>
      </div>
      <Link href={`/annonces#a-${annonce.id}`} className="dash-forfait-banner-btn" onClick={fermer}>
        {t("Lire l'annonce")}
      </Link>
      <button type="button" className="dash-annonce-fermer" onClick={fermer} aria-label={t("Masquer")} title={t("Masquer")}>
        ×
      </button>
    </div>
  );
}
