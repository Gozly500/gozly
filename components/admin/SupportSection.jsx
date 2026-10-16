"use client";

import { useState } from "react";
import TicketsSection from "@/components/admin/TicketsSection";
import DemandesContactSection from "@/components/admin/DemandesContactSection";

const SOUS = [
  { id: "tickets", label: "Tickets Discord" },
  { id: "contact", label: "Formulaire de contact" },
];

// Onglet "Support" du panneau admin : tout ce que les clients envoient pour avoir de l'aide.
// (Les tickets créés depuis le site s'ajouteront ici plus tard.)
export default function SupportSection({ ticketsOuverts = 0 }) {
  const [sous, setSous] = useState("tickets");
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
            {s.id === "tickets" && ticketsOuverts > 0 && <span className="admin-badge">{ticketsOuverts}</span>}
          </button>
        ))}
      </div>
      {sous === "tickets" && <TicketsSection />}
      {sous === "contact" && <DemandesContactSection />}
    </div>
  );
}
