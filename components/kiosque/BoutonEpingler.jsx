"use client";

import { useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";
import { IconMusique } from "@/components/icons/GozlyIcons";

// Bouton « Épingler » du kiosque Musique : demande si on veut le lecteur compact (petit, au centre en bas) ou
// développé (grand, sur le côté) sur les autres kiosques, puis appelle onChoix("compact" | "large" | "off").
// mode : l'épinglage actuel ("off" | "compact" | "large") ; une fois épinglé, le menu permet aussi de le retirer.
export default function BoutonEpingler({ mode = "off", onChoix, style }) {
  const { t } = useLangue();
  const [ouvert, setOuvert] = useState(false);
  const epingle = mode !== "off";

  const choisir = (m) => {
    setOuvert(false);
    onChoix(m);
  };
  const option = (m, titre, desc) => (
    <button type="button" role="menuitemradio" aria-checked={mode === m} className={`mkp-choix-option${mode === m ? " actif" : ""}`} onClick={() => choisir(m)}>
      <strong>{titre}</strong>
      <span>{desc}</span>
    </button>
  );

  return (
    <>
      <button
        type="button"
        aria-label={t("kq.mus.epingler")}
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        style={{
          position: "fixed",
          bottom: "4px",
          left: "54px",
          zIndex: 50,
          height: "44px",
          padding: "0 16px 0 12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          border: 0,
          borderRadius: "22px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 600,
          // Couleurs pleines (mélange du texte et du fond) plutôt que de l'opacité, qui ferait voir les calques des icônes.
          background: epingle ? "var(--violet, #8a56fe)" : "color-mix(in srgb, var(--text, #ffffff) 14%, var(--navy, #0d0d3f))",
          color: epingle ? "#fff" : "color-mix(in srgb, var(--text, #ffffff) 70%, var(--navy, #0d0d3f))",
          ...style,
        }}
      >
        <IconMusique className="gozly-icon" style={{ width: 20, height: 20 }} />
        {t(epingle ? "kq.mus.epingle" : "kq.mus.epinglerCourt")}
      </button>
      {ouvert && (
        <>
          <div className="mkp-choix-fond" onClick={() => setOuvert(false)} />
          <div className="mkp-choix" role="menu">
            <div className="mkp-choix-titre">{t("kq.mus.epingler")}</div>
            <p className="mkp-choix-aide">{t("kq.mus.epinglerAide")}</p>
            {option("compact", t("kq.mus.modeCompact"), t("kq.mus.modeCompactDesc"))}
            {option("large", t("kq.mus.modeDeveloppe"), t("kq.mus.modeDeveloppeDesc"))}
            {epingle && (
              <button type="button" role="menuitem" className="mkp-choix-option" onClick={() => choisir("off")}>
                <strong>{t("kq.mus.retirerEpingle")}</strong>
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
