"use client";

import { useState } from "react";
import { useT } from "@/components/LangProvider";
import { IconTelecharger } from "@/components/icons/Pictogrammes";

// Les deux téléchargements de la page : le kit de marque (ZIP, fabriqué par /api/marque/kit) et la charte graphique (PDF, générée ici).
export default function BoutonsKit() {
  const { t } = useT();
  const [enCours, setEnCours] = useState(false);

  async function charte() {
    setEnCours(true);
    try {
      const { telechargerCharteGraphique } = await import("@/lib/charteGraphique");
      await telechargerCharteGraphique();
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="marque-boutons">
      <a className="submit-btn" href="/api/marque/kit" download>
        <IconTelecharger className="gozly-icon" /> {t("marque.kit")}
      </a>
      <button type="button" className="btn-pill-glass" onClick={charte} disabled={enCours}>
        <IconTelecharger className="gozly-icon" /> {enCours ? t("marque.charteEnCours") : t("marque.charte")}
      </button>
    </div>
  );
}
