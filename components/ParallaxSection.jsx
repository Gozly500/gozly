"use client";

import { useEffect, useRef } from "react";

// Effet de parallaxe piloté au scroll (pas de background-attachment:fixed,
// notoirement peu fiable selon les navigateurs) - l'image est surdimensionnée
// dans sa section (object-fit:cover) et se déplace verticalement à une
// vitesse différente du reste de la page. Désactivé sous 900px (mobile) :
// image fixe, pas de mouvement.
export default function ParallaxSection({ id, src, alt }) {
  const sectionRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 900px)").matches) return;

    const section = sectionRef.current;
    const img = imgRef.current;
    if (!section || !img) return;

    let ticking = false;

    function update() {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const offset = (rect.top - vh / 2) * 0.18;
      img.style.transform = `translateY(calc(-50% + ${offset}px))`;
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
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section id={id} className="module-showcase" ref={sectionRef}>
      <img ref={imgRef} src={src} alt={alt} />
    </section>
  );
}
