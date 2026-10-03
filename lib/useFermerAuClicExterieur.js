"use client";

import { useEffect } from "react";

// Ferme une liste déroulante (menu, sélecteur) quand on clique ou touche
// N'IMPORTE OÙ en dehors d'elle, ou qu'on appuie sur Échap. Le clic sur le
// bouton qui l'ouvre reste géré par ce bouton lui-même (il alterne
// ouvert/fermé) : comme il est dans `ref`, il n'est pas considéré "dehors".
//
// ref    : ref du conteneur qui englobe le bouton ET la liste
// ouvert : la liste est-elle ouverte ?
// fermer : fonction qui ferme la liste
export function useFermerAuClicExterieur(ref, ouvert, fermer) {
  useEffect(() => {
    if (!ouvert) return;

    function surClic(e) {
      if (ref.current && !ref.current.contains(e.target)) fermer();
    }
    function surTouche(e) {
      if (e.key === "Escape") fermer();
    }

    document.addEventListener("mousedown", surClic);
    document.addEventListener("touchstart", surClic);
    document.addEventListener("keydown", surTouche);
    return () => {
      document.removeEventListener("mousedown", surClic);
      document.removeEventListener("touchstart", surClic);
      document.removeEventListener("keydown", surTouche);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);
}
