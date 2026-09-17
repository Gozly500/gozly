"use client";

import { useEffect, useRef } from "react";

// Durée réelle de l'animation (voir "op"/"fr" dans le JSON): ~2.56s -
// filet de sécurité si le fichier tarde à charger ou que l'évènement
// "complete" ne se déclenche pas.
const FILET_SECURITE_MS = 3500;

export default function MoiChargement({ onTermine }) {
  const lottieRef = useRef(null);

  useEffect(() => {
    if (!lottieRef.current) return;

    let anim;
    let cancelled = false;

    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !lottieRef.current) return;
      anim = lottie.loadAnimation({
        container: lottieRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: "/animations/moi-ouverture.json",
      });
      anim.addEventListener("complete", () => onTermine?.());
    });

    const filet = setTimeout(() => onTermine?.(), FILET_SECURITE_MS);

    return () => {
      cancelled = true;
      clearTimeout(filet);
      anim?.destroy();
    };
  }, [onTermine]);

  return (
    <div className="moi-loading">
      <div className="moi-loading-lottie-wrap">
        <div ref={lottieRef} className="moi-loading-lottie"></div>
      </div>
    </div>
  );
}
