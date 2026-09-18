"use client";

import { useRouter } from "next/navigation";

const SECTIONS = [
  { id: "apparence", emoji: "🎨", titre: "Apparence", description: "Thème visuel de l'application", href: "/moi/parametres/apparence" },
  {
    id: "notifications",
    emoji: "🔔",
    titre: "Notifications",
    description: "Ce qui déclenche une notification",
    href: "/moi/parametres/notifications",
  },
];

export default function ParametresEmploye() {
  const router = useRouter();

  return (
    <div>
      <h2>Paramètres</h2>

      <div className="moi-settings-list">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" className="moi-settings-item" onClick={() => router.push(s.href)}>
            <span className="moi-settings-item-emoji">{s.emoji}</span>
            <span className="moi-settings-item-text">
              <strong>{s.titre}</strong>
              <span>{s.description}</span>
            </span>
            <span className="moi-settings-item-chevron">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
