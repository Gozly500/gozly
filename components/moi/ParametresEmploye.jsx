"use client";

import { useRouter } from "next/navigation";
import { useLangue } from "@/components/moi/LangueContext";
import { LANGUES } from "@/lib/i18n/moi";

const SECTIONS = [
  { id: "apparence", emoji: "🎨", titreCle: "parametres.apparenceTitre", descCle: "parametres.apparenceDesc", href: "/moi/parametres/apparence" },
  {
    id: "notifications",
    emoji: "🔔",
    titreCle: "parametres.notificationsTitre",
    descCle: "parametres.notificationsDesc",
    href: "/moi/parametres/notifications",
  },
];

export default function ParametresEmploye() {
  const router = useRouter();
  const { t, langue, setLangue } = useLangue();

  return (
    <div>
      <h2>{t("parametres.titre")}</h2>

      <div className="moi-settings-list">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" className="moi-settings-item" onClick={() => router.push(s.href)}>
            <span className="moi-settings-item-emoji">{s.emoji}</span>
            <span className="moi-settings-item-text">
              <strong>{t(s.titreCle)}</strong>
              <span>{t(s.descCle)}</span>
            </span>
            <span className="moi-settings-item-chevron">›</span>
          </button>
        ))}

        <div className="moi-settings-item" style={{ cursor: "default" }}>
          <span className="moi-settings-item-emoji">🌐</span>
          <span className="moi-settings-item-text">
            <strong>{t("parametres.langueTitre")}</strong>
            <span>{t("parametres.langueDesc")}</span>
          </span>
          <div style={{ display: "flex", gap: "6px" }}>
            {LANGUES.map((l) => (
              <button
                key={l.id}
                type="button"
                className="admin-icon-btn"
                style={langue === l.id ? { borderColor: "var(--violet)", color: "var(--fg)" } : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  setLangue(l.id);
                }}
              >
                {l.id.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
