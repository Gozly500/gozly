"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/LangProvider";

// Petit rond "i" qui ouvre une bulle d'explication au survol (ou au clic/tap
// sur mobile) - remplace les longs paragraphes d'aide sous chaque réglage.
// alerte : variante "!" toujours visible (hors d'un .field), bulle alignée à droite.
export default function InfoTooltip({ children, symbole = "i", alerte = false }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function fermerSiDehors(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", fermerSiDehors);
    return () => document.removeEventListener("mousedown", fermerSiDehors);
  }, [open]);

  return (
    <span
      ref={ref}
      className={`info-tip${open ? " open" : ""}${alerte ? " info-tip-warn" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-tip-btn"
        aria-label={t("Plus d'information")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      >
        {symbole}
      </button>
      {open && (
        <span className="info-tip-bubble" role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}
