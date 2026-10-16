"use client";

import { useState } from "react";
import TicketsSection from "@/components/admin/TicketsSection";
import VotesSection from "@/components/admin/VotesSection";

const SOUS = [
  { id: "tickets", label: "Tickets" },
  { id: "votes", label: "Votes" },
];

// Onglet "Discord" du panneau admin : tout ce que Gozlyx fait sur le serveur Discord de Gozly.
export default function DiscordSection({ ticketsOuverts = 0 }) {
  const [sous, setSous] = useState("tickets");
  return (
    <div>
      <div className="settings-nav" style={{ flexDirection: "row", width: "fit-content", marginBottom: "26px" }}>
        {SOUS.map((s) => (
          <button key={s.id} type="button" className={`settings-nav-item${sous === s.id ? " active" : ""}`} onClick={() => setSous(s.id)}>
            {s.label}
            {s.id === "tickets" && ticketsOuverts > 0 && <span className="admin-badge">{ticketsOuverts}</span>}
          </button>
        ))}
      </div>
      {sous === "tickets" && <TicketsSection />}
      {sous === "votes" && <VotesSection />}
    </div>
  );
}
