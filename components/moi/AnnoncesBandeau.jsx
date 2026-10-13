"use client";

import { useAnnonces } from "@/components/moi/AnnoncesContext";
import CarteAnnonce from "@/components/moi/CarteAnnonce";

// Bandeau en haut de l'app : les annonces et rappels pas encore vus (« OK » les retire d'ici ; ils restent
// consultables dans la page « Annonces et rappels », ouverte avec la cloche de l'en-tête).
export default function AnnoncesBandeau() {
  const { items, masquees, masquer } = useAnnonces();
  const visibles = items.filter((a) => !masquees.has(a.id));
  if (visibles.length === 0) return null;

  return (
    <div className="moi-annonces">
      {visibles.map((a) => (
        <CarteAnnonce key={a.id} a={a} onOk={() => masquer(a.id)} />
      ))}
    </div>
  );
}
