"use client";

import VotesSection from "@/components/admin/VotesSection";
import BotSection from "@/components/admin/BotSection";
import AnnoncesSection from "@/components/admin/AnnoncesSection";

// Onglet "Discord" du panneau admin : tout ce que Gozyx fait sur le serveur Discord de Gozly
// (sauf les tickets, qui sont dans l'onglet Support). Le sous-menu est dans la barre latérale
// (voir AdminContent) ; les prochains systèmes Discord s'ajoutent ici et dans SOUS_MENUS.
export default function DiscordSection({ sous }) {
  return (
    <div>
      {sous === "annonces" && <AnnoncesSection />}
      {sous === "votes" && <VotesSection />}
      {sous === "bot" && <BotSection />}
    </div>
  );
}
