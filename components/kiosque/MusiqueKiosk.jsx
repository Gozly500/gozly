"use client";

import { useEntrepriseKiosque } from "@/components/kiosque/useEntrepriseKiosque";
import MusiqueEpingle from "@/components/kiosque/MusiqueEpingle";

// Écran kiosque « Musique » : le grand lecteur en plein écran (deux colonnes), pour une tablette dédiée à la musique.
export default function MusiqueKiosk() {
  const { entrepriseId } = useEntrepriseKiosque();
  if (!entrepriseId) return null;
  return <MusiqueEpingle mode="plein" entrepriseId={entrepriseId} />;
}
