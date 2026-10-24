"use client";

import { useLayoutEffect, useRef } from "react";

const DUREE_DECALAGE_MS = 420;
const DELAI_NOUVELLE_MS = 200; // les autres cartes se poussent d'abord, puis la nouvelle grandit dans la place libérée
const DUREE_NOUVELLE_MS = 560;
const COURBE_DECALAGE = "cubic-bezier(.22,.8,.3,1)";
const COURBE_NOUVELLE = "cubic-bezier(.34,1.35,.5,1)"; // un tout petit rebond à l'arrivée

// Animation des cartes d'une liste (kiosque des commandes) quand la liste change :
//  - les cartes déjà là glissent de leur ancienne place à la nouvelle (elles « se décalent ») ;
//  - une carte nouvelle part toute petite, au milieu de sa place, et grossit jusqu'à sa taille normale.
//  - desagreger(id) : la carte se brise en morceaux qui s'envolent un à un (de gauche à droite), puis disparaît.
// Usage : const anim = useAnimationCartes(liste) ; <article ref={anim.ref(id)}> ; anim.preparer() juste AVANT de changer la liste.
// Rien ne bouge si preparer() n'a pas été appelé (premier chargement, filtre de recherche...).
export function useAnimationCartes(liste) {
  const cartes = useRef(new Map()); // id -> élément
  const avant = useRef(null); // id -> { left, top } mesurés juste avant le changement
  const expire = useRef(0);

  const ref = (id) => (el) => {
    if (el) cartes.current.set(id, el);
    else cartes.current.delete(id);
  };

  function preparer() {
    const positions = new Map();
    for (const [id, el] of cartes.current) {
      const r = el.getBoundingClientRect();
      positions.set(id, { left: r.left, top: r.top });
    }
    avant.current = positions;
    // Si la liste ne change finalement pas, on ne garde pas ces mesures pour un changement bien plus tard.
    clearTimeout(expire.current);
    expire.current = setTimeout(() => {
      avant.current = null;
    }, 3000);
  }

  // Désagrégation : la carte est découpée en une grille de petits morceaux (des copies de la carte, chacune coupée à sa case) qui
  // partent un à un, en vague de gauche à droite, en tournant, en rapetissant et en s'effaçant. L'original est caché pendant ce temps.
  // Retourne null si rien à animer (carte absente, mouvement réduit), sinon { annuler() } pour tout remettre si la suppression échoue.
  function desagreger(id, { colonnes = 12, lignes = 5 } = {}) {
    const el = cartes.current.get(id);
    if (!el || !el.animate || typeof window === "undefined") return null;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;

    const r = el.getBoundingClientRect();
    const hote = el.parentElement || document.body;
    const conteneur = document.createElement("div");
    conteneur.setAttribute("aria-hidden", "true");
    Object.assign(conteneur.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", zIndex: "80", pointerEvents: "none" });

    const animations = [];
    for (let l = 0; l < lignes; l++) {
      for (let c = 0; c < colonnes; c++) {
        const morceau = document.createElement("div");
        const copie = el.cloneNode(true);
        copie.removeAttribute("id");
        Object.assign(copie.style, { position: "absolute", left: "0", top: "0", width: r.width + "px", height: r.height + "px", margin: "0", transform: "none" });
        Object.assign(morceau.style, {
          position: "absolute",
          inset: "0",
          clipPath: `inset(${(l / lignes) * 100}% ${100 - ((c + 1) / colonnes) * 100}% ${100 - ((l + 1) / lignes) * 100}% ${(c / colonnes) * 100}%)`,
          willChange: "transform, opacity",
        });
        morceau.appendChild(copie);
        conteneur.appendChild(morceau);

        const delai = (c / colonnes) * 480 + Math.random() * 160;
        const duree = 650 + Math.random() * 350;
        animations.push(
          morceau.animate(
            [
              { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1, filter: "blur(0px)" },
              {
                transform: `translate(${40 + Math.random() * 130}px, ${-70 + Math.random() * 100}px) rotate(${(Math.random() - 0.5) * 60}deg) scale(${0.3 + Math.random() * 0.4})`,
                opacity: 0,
                filter: "blur(3px)",
              },
            ],
            { duration: duree, delay: delai, easing: "cubic-bezier(.4,0,.8,.6)", fill: "both" }
          )
        );
      }
    }

    hote.appendChild(conteneur);
    el.style.visibility = "hidden";
    const nettoyer = () => conteneur.remove();
    const minuteur = setTimeout(nettoyer, 1900);
    Promise.all(animations.map((a) => a.finished.catch(() => null))).then(() => {
      clearTimeout(minuteur);
      nettoyer();
    });
    return {
      annuler() {
        clearTimeout(minuteur);
        nettoyer();
        el.style.visibility = "";
      },
    };
  }

  useLayoutEffect(() => {
    const prev = avant.current;
    if (!prev) return;
    avant.current = null;
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    for (const [id, el] of cartes.current) {
      if (!el.animate) continue;
      const ancien = prev.get(id);
      if (!ancien) {
        // Carte nouvelle : toute petite, invisible, puis elle grossit à sa place.
        el.animate(
          [
            { transform: "scale(.08)", opacity: 0 },
            { transform: "scale(1)", opacity: 1 },
          ],
          { duration: DUREE_NOUVELLE_MS, delay: DELAI_NOUVELLE_MS, easing: COURBE_NOUVELLE, fill: "backwards" }
        );
        continue;
      }
      const r = el.getBoundingClientRect();
      const dx = ancien.left - r.left;
      const dy = ancien.top - r.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], { duration: DUREE_DECALAGE_MS, easing: COURBE_DECALAGE });
    }
  }, [liste]);

  return { ref, preparer, desagreger };
}
