"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Durée de la sortie de la liste (ms). Courte exprès : on ne veut pas ralentir le travail. Voir .kq-liste / .kq-entree dans globals.css.
export const DUREE_SORTIE_MS = 150;

// Choix d'un kiosque dans la liste : la liste s'agrandit et s'efface (le zoom part de la carte touchée), puis on ouvre le
// kiosque, qui arrive en petit et grossit (.kq-entree). Un clic avec Ctrl / Cmd / Maj, ou un appareil réglé pour limiter
// les animations, garde le lien normal, sans animation.
export function useTransitionKiosque() {
  const router = useRouter();
  const [sortant, setSortant] = useState(null); // { id, x, y } : la carte choisie et le centre du zoom
  const conteneur = useRef(null);

  function choisir(e, id, href) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    if (sortant) return;

    const zone = conteneur.current?.getBoundingClientRect();
    const carte = e.currentTarget.getBoundingClientRect();
    setSortant({ id, x: carte.left + carte.width / 2 - (zone?.left || 0), y: carte.top + carte.height / 2 - (zone?.top || 0) });
    setTimeout(() => router.push(href), DUREE_SORTIE_MS);
    setTimeout(() => setSortant(null), 3000); // si l'ouverture traîne ou échoue, la liste redevient utilisable
  }

  return { sortant, choisir, conteneur };
}
