"use client";

import { useState } from "react";
import { useT } from "@/components/LangProvider";
import { rgb } from "@/lib/marque";

// Une pastille de couleur : un clic copie le code hexadécimal.
export default function CouleurCarte({ nom, hex, role }) {
  const { t } = useT();
  const [copie, setCopie] = useState(false);
  const clair = rgb(hex).reduce((s, v) => s + v, 0) > 480;

  async function copier() {
    try {
      await navigator.clipboard.writeText(hex.toUpperCase());
      setCopie(true);
      setTimeout(() => setCopie(false), 1400);
    } catch {}
  }

  return (
    <button type="button" className="marque-couleur" onClick={copier} title={hex.toUpperCase()}>
      <span className="marque-couleur-puce" style={{ background: hex, color: clair ? "#111" : "#fff" }}>
        {copie ? t("marque.copie") : ""}
      </span>
      <span className="marque-couleur-nom">{nom}</span>
      <span className="marque-couleur-code">
        {hex.toUpperCase()} · RGB {rgb(hex).join(", ")}
      </span>
      <span className="marque-couleur-role">{role}</span>
    </button>
  );
}
