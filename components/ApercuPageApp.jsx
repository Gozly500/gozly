"use client";

import { useEffect, useState } from "react";
import { REGLES_PAGE } from "@/lib/appsDeveloppeur";

// Aperçu de la page de gestion d'une app (développeur ou admin) : thème clair/sombre, bureau/mobile, et rappel des règles.
// `charger(theme, accent, lang)` renvoie l'adresse signée de la page (ou null).
export default function ApercuPageApp({ titre, charger, onFermer, t = (x) => x }) {
  const [theme, setTheme] = useState("sombre");
  const [mobile, setMobile] = useState(false);
  const [url, setUrl] = useState(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let ignore = false;
    setUrl(null);
    setErreur(false);
    charger(theme, "#3a37d1", "fr").then((u) => {
      if (ignore) return;
      if (u) setUrl(u);
      else setErreur(true);
    });
    return () => {
      ignore = true;
    };
  }, [theme]);

  const bouton = (actif, texte, onClick) => (
    <button type="button" className={`admin-icon-btn${actif ? " active" : ""}`} onClick={onClick} style={actif ? { outline: "2px solid currentColor" } : undefined}>
      {texte}
    </button>
  );

  return (
    <div className="modal-overlay" onClick={onFermer}>
      <div className="modal-card" style={{ maxWidth: "980px", width: "95vw" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{titre}</h3>
          <button type="button" className="admin-icon-btn" onClick={onFermer}>
            {t("Fermer")}
          </button>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
          {bouton(theme === "sombre", t("Sombre"), () => setTheme("sombre"))}
          {bouton(theme === "clair", t("Clair"), () => setTheme("clair"))}
          {bouton(!mobile, t("Bureau"), () => setMobile(false))}
          {bouton(mobile, t("Mobile"), () => setMobile(true))}
        </div>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div
            style={{
              flex: "1 1 460px",
              minWidth: 0,
              display: "flex",
              justifyContent: "center",
              padding: "12px",
              borderRadius: "14px",
              background: theme === "clair" ? "#eceef3" : "#0b0b0d",
            }}
          >
            {erreur ? (
              <p className="settings-msg err">{t("Page indisponible.")}</p>
            ) : url ? (
              <iframe
                src={url}
                title={titre}
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                referrerPolicy="no-referrer"
                style={{ width: mobile ? "375px" : "100%", maxWidth: "100%", height: "560px", border: 0, background: "transparent" }}
              />
            ) : (
              <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>
            )}
          </div>
          <div style={{ flex: "0 1 260px", fontSize: "13.5px" }}>
            <strong>{t("Règles de la page")}</strong>
            <ul style={{ margin: "8px 0 0 18px", display: "grid", gap: "6px" }}>
              {REGLES_PAGE.map((r) => (
                <li key={r}>{t(r)}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
