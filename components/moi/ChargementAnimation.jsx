"use client";

import { useEffect, useRef, useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";

// Animation du logo Gozly en boucle (public/animations/gozly-chargement.json), à la place du texte « Chargement... »
// pendant que les pages de l'app employé chargent. Si l'animation ne peut pas se charger, on retombe sur le texte.
export default function ChargementAnimation({ taille = 110, plein = false }) {
  const { t } = useLangue();
  const conteneur = useRef(null);
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    let anim;
    let annule = false;

    import("lottie-web")
      .then(({ default: lottie }) => {
        if (annule || !conteneur.current) return;
        anim = lottie.loadAnimation({
          container: conteneur.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          path: "/animations/gozly-chargement.json",
        });
        anim.addEventListener("data_failed", () => setEchec(true));
      })
      .catch(() => setEchec(true));

    return () => {
      annule = true;
      anim?.destroy();
    };
  }, []);

  return (
    <div className={`moi-chargement${plein ? " plein" : ""}`} role="status" aria-label={t("nav.chargement")}>
      {echec ? (
        <p style={{ color: "var(--text-dim)" }}>{t("nav.chargement")}</p>
      ) : (
        <div ref={conteneur} className="moi-chargement-lottie" style={{ width: taille, height: taille }} />
      )}
    </div>
  );
}
