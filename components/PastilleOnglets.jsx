"use client";

import { useEffect, useState } from "react";

// Position de la pastille à la page précédente (le module survit aux navigations) : la nouvelle page part de là et glisse vers
// l'onglet actif, même si la barre d'onglets est recréée à chaque changement de page.
let dernierIndex = null;

// Pastille de la barre d'onglets en pilule (.moi-tabbar) : glisse sous l'onglet actif.
// index : position de l'onglet actif (-1 = aucun, la pastille se cache) ; nb : nombre d'onglets de la barre.
export default function PastilleOnglets({ index, nb }) {
  const [affiche, setAffiche] = useState(dernierIndex !== null ? dernierIndex : index);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAffiche(index)));
    dernierIndex = index;
    return () => cancelAnimationFrame(id);
  }, [index]);

  return <span className={`moi-tab-pastille${affiche < 0 ? " cachee" : ""}`} style={{ "--nb": nb, "--i": Math.max(affiche, 0) }} aria-hidden="true" />;
}
