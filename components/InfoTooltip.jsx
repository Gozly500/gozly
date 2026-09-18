"use client";

import { useEffect, useRef, useState } from "react";

// Petit rond "i" qui ouvre une bulle d'explication au survol (ou au clic/tap
// sur mobile) - remplace les longs paragraphes d'aide sous chaque réglage.
export default function InfoTooltip({ children }) {
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
      className={`info-tip${open ? " open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-tip-btn"
        aria-label="Plus d'information"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      >
        i
      </button>
      {open && (
        <span className="info-tip-bubble" role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}
