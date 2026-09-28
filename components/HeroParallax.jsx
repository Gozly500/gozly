"use client";

import { useEffect, useRef } from "react";

// Image de fond de la section d'en-tête (Accueil) - se déplace très
// lentement au scroll (facteur ~0.12) pour donner l'impression qu'elle
// "reste sur place" pendant que le reste de la page défile normalement.
// Même technique que ParallaxSection (JS + transform, pas
// background-attachment:fixed - peu fiable selon les navigateurs).
// Désactivée sous 900px (mobile) : image fixe, pas de mouvement.
export default function HeroParallax({ src }) {
  const imgRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 900px)").matches) return;

    const img = imgRef.current;
    if (!img) return;

    let ticking = false;

    function update() {
      img.style.transform = `translateY(${window.scrollY * 0.12}px)`;
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="hero-parallax-bg" aria-hidden="true">
      <img ref={imgRef} src={src} alt="" />
    </div>
  );
}
