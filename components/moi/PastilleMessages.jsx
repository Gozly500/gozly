"use client";

import { useAnnonces } from "@/components/moi/AnnoncesContext";

// Petit point rouge sur l'icône Discussion quand une conversation (hors sourdine) a un message non lu.
export default function PastilleMessages() {
  const { messagesNonLus } = useAnnonces();
  if (!messagesNonLus.length) return null;
  return <span className="moi-pastille-rouge" aria-hidden="true" />;
}
