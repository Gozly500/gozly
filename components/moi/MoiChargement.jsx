"use client";

import { useEffect, useRef } from "react";

export default function MoiChargement() {
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
        loop: true,
        autoplay: true,
        path: "/animations/moi-ouverture.json",
      });
    });

    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, []);

  return (
    <div className="moi-loading">
      <div ref={lottieRef} className="moi-loading-lottie"></div>
    </div>
  );
}
