"use client";

import { useEffect } from "react";

// Effets dynamiques de l'accueil (aucun rendu) :
//  - apparition au défilement des éléments .rv ;
//  - barre de progression du défilement (--sp) ;
//  - souris : léger décalage des blobs
//    et des pastilles du haut (--px/--py), inclinaison des visuels de modules.
// Tout est coupé si la personne a demandé moins d'animations.
export default function HomeFx() {
  useEffect(() => {
    const root = document.querySelector(".home, .page-default, .page-contact");
    if (!root) return;
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const souris = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const cibles = () => root.querySelectorAll(".rv:not(.in)");
    let io = null;
    if (reduit || !("IntersectionObserver" in window)) {
      cibles().forEach((el) => el.classList.add("in"));
    } else {
      document.documentElement.classList.add("fx");
      io = new IntersectionObserver(
        (entrees) =>
          entrees.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("in");
              io.unobserve(e.target);
            }
          }),
        { threshold: 0.14, rootMargin: "0px 0px -6% 0px" }
      );
      cibles().forEach((el) => io.observe(el));
    }

    // Progression du défilement
    let rafScroll = 0;
    const surScroll = () => {
      if (rafScroll) return;
      rafScroll = requestAnimationFrame(() => {
        rafScroll = 0;
        const h = document.documentElement.scrollHeight - window.innerHeight;
        root.style.setProperty("--sp", h > 0 ? String(Math.min(1, window.scrollY / h)) : "0");
      });
    };
    window.addEventListener("scroll", surScroll, { passive: true });
    surScroll();

    // Souris
    let rafMove = 0;
    let dernier = null;
    const appliquer = () => {
      rafMove = 0;
      const e = dernier;
      if (!e) return;
      root.style.setProperty("--px", String((e.clientX / window.innerWidth - 0.5) * 2));
      root.style.setProperty("--py", String((e.clientY / window.innerHeight - 0.5) * 2));
      const v = e.target.closest?.(".vitrine-visuel");
      if (v) {
        const r = v.getBoundingClientRect();
        v.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 14}deg`);
        v.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - 0.5) * -14}deg`);
      }
    };
    const surSouris = (e) => {
      dernier = e;
      if (!rafMove) rafMove = requestAnimationFrame(appliquer);
    };
    const quitteVisuel = (e) => {
      const v = e.target.closest?.(".vitrine-visuel");
      if (v && !v.contains(e.relatedTarget)) {
        v.style.setProperty("--rx", "0deg");
        v.style.setProperty("--ry", "0deg");
      }
    };
    if (souris && !reduit) {
      root.classList.add("souris");
      window.addEventListener("pointermove", surSouris, { passive: true });
      root.addEventListener("pointerout", quitteVisuel);
    }

    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", surScroll);
      window.removeEventListener("pointermove", surSouris);
      root.removeEventListener("pointerout", quitteVisuel);
      cancelAnimationFrame(rafScroll);
      cancelAnimationFrame(rafMove);
      document.documentElement.classList.remove("fx");
      root.classList.remove("souris");
    };
  }, []);

  return (
    <>
      <div className="home-progress" aria-hidden="true" />
    </>
  );
}
