"use client";

import { useEffect } from "react";
import Lenis from "lenis";

// Défilement doux (inertie) pour la page d'accueil seulement. Désactivé si la personne
// a demandé moins d'animations. Les liens d'ancre (#section) glissent aussi doucement.
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      duration: 1.15,
      anchors: { offset: -100 },
    });
    document.documentElement.classList.add("lenis");
    let raf;
    const boucle = (t) => {
      lenis.raf(t);
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      document.documentElement.classList.remove("lenis");
    };
  }, []);
  return null;
}
