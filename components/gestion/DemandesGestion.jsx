"use client";

import DemandesSection from "@/components/entreprise/DemandesSection";
import { useGestion } from "@/components/gestion/GestionShell";

// Demandes (congés, échanges de quart) : même contenu que le dashboard,
// mis en page pour le téléphone par les règles .gestion-page du CSS.
export default function DemandesGestion() {
  const { entrepriseId } = useGestion();
  return <DemandesSection entrepriseId={entrepriseId} />;
}
