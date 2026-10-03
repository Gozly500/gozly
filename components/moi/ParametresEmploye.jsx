"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLangue } from "@/components/moi/LangueContext";
import { LANGUES } from "@/lib/i18n/moi";

// Cas rencontré en test : un employé a refusé l'accès à la localisation par
// accident au tout premier pointage mobile, et ne pouvait plus jamais
// pointer ensuite - une fois "refusé", le navigateur ne redemande jamais
// automatiquement. Ce bouton tente de redéclencher la demande (ça marche
// si l'état est encore "pas décidé" sur cet appareil) et, si c'est déjà
// bloqué, affiche comment le débloquer manuellement.
function SectionLocalisation({ t }) {
  const [etat, setEtat] = useState(null); // null (pas encore vérifié) | "accordee" | "refusee" | "indisponible"
  const [verification, setVerification] = useState(false);
  const [guideOuvert, setGuideOuvert] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setEtat("indisponible");
      return;
    }
    if (!navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((p) => {
        setEtat(p.state === "granted" ? "accordee" : p.state === "denied" ? "refusee" : null);
      })
      .catch(() => {});
  }, []);

  function tester() {
    setVerification(true);
    setGuideOuvert(false);
    navigator.geolocation.getCurrentPosition(
      () => {
        setEtat("accordee");
        setVerification(false);
      },
      (err) => {
        setVerification(false);
        if (err.code === 1) {
          setEtat("refusee");
          setGuideOuvert(true);
        }
      },
      { timeout: 10000 }
    );
  }

  return (
    <>
      <button type="button" className="moi-settings-item" style={{ cursor: "pointer" }} onClick={tester}>
        <span className="moi-settings-item-emoji">📍</span>
        <span className="moi-settings-item-text">
          <strong>{t("parametres.localisationTitre")}</strong>
          <span>
            {etat === "accordee"
              ? t("localisation.ok")
              : etat === "refusee"
              ? t("localisation.refusee")
              : t("parametres.localisationDesc")}
          </span>
        </span>
        <span className="moi-settings-item-chevron">{verification ? "…" : t("localisation.activer")}</span>
      </button>

      {guideOuvert && (
        <div className="section-hint" style={{ margin: "-6px 0 10px", padding: "0 4px" }}>
          <strong>{t("localisation.guideTitre")}</strong>
          <p style={{ margin: "4px 0 0" }}>{t("localisation.guideAndroid")}</p>
          <p style={{ margin: "4px 0 0" }}>{t("localisation.guideIphone")}</p>
        </div>
      )}
    </>
  );
}

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

        <SectionLocalisation t={t} />
      </div>
    </div>
  );
}
