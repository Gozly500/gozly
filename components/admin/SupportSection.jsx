"use client";

import TicketsSection from "@/components/admin/TicketsSection";
import DemandesContactSection from "@/components/admin/DemandesContactSection";

// Onglet "Support" du panneau admin : tout ce que les clients envoient pour avoir de l'aide.
// Le sous-menu est dans la barre latérale (voir AdminContent). Les tickets créés depuis le site
// s'ajouteront ici plus tard.
export default function SupportSection({ sous }) {
  return (
    <div>
      {sous === "tickets" && <TicketsSection />}
      {sous === "contact" && <DemandesContactSection />}
    </div>
  );
}
