"use client";

import { useState } from "react";
import VotesSection from "@/components/admin/VotesSection";
import BotSection from "@/components/admin/BotSection";

const SOUS = [
  { id: "votes", label: "Référendums" },
  { id: "bot", label: "Bot" },
];

// Onglet "Discord" du panneau admin : tout ce que Gozlyx fait sur le serveur Discord de Gozly
// (sauf les tickets, qui sont dans l'onglet Support). Les prochains systèmes Discord s'ajoutent ici.
export default function DiscordSection() {
  const [sous, setSous] = useState("votes");
  return (
    <div>
      <div className="settings-nav" style={{ flexDirection: "row", width: "fit-content", marginBottom: "26px", flexWrap: "wrap" }}>
        {SOUS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`settings-nav-item${sous === s.id ? " active" : ""}`}
            style={{ whiteSpace: "nowrap" }}
            onClick={() => setSous(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sous === "votes" && <VotesSection />}
      {sous === "bot" && <BotSection />}
    </div>
  );
}
