"use client";

import { useEffect, useRef, useState } from "react";

// Durée réelle de l'animation (voir "op"/"fr" dans le JSON): ~2.56s -
// filet de sécurité si le fichier tarde à charger ou que l'évènement
// "complete" ne se déclenche pas.
const FILET_SECURITE_MS = 3500;
// Doit matcher la transition CSS de .moi-loading-sortie (globals.css).
const DUREE_FADE_MS = 400;

export default function MoiChargement({ onTermine }) {
  const lottieRef = useRef(null);
  const [enSortie, setEnSortie] = useState(false);

  useEffect(() => {
    if (!lottieRef.current) return;

    let anim;
    let cancelled = false;

    function terminer() {
      setEnSortie(true);
      setTimeout(() => onTermine?.(), DUREE_FADE_MS);
    }

    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !lottieRef.current) return;
      anim = lottie.loadAnimation({
        container: lottieRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: "/animations/moi-ouverture.json",
      });
      anim.addEventListener("complete", terminer);
    });

    const filet = setTimeout(terminer, FILET_SECURITE_MS);

    return () => {
      cancelled = true;
      clearTimeout(filet);
      anim?.destroy();
    };
  }, [onTermine]);

  return (
    <div className={`moi-loading${enSortie ? " moi-loading-sortie" : ""}`}>
      <div className="moi-loading-lottie-wrap">
        <div ref={lottieRef} className="moi-loading-lottie"></div>
      </div>
    </div>
  );
}
