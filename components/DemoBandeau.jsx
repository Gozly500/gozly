"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";
import { demoActif, quitterDemo, CLE_DONNEES_DEMO } from "@/lib/demo/actif";

// Petite pastille en bas de l'écran pendant la démo : rappelle que rien n'est enregistré, permet de recommencer
// (données fictives recréées) ou de quitter. Ne s'affiche que si le mode démo est actif dans cet onglet.
export default function DemoBandeau() {
  const { t } = useT();
  const [actif, setActif] = useState(false);
  useEffect(() => setActif(demoActif()), []);
  if (!actif) return null;

  function recommencer() {
    window.__demoReset = true;
    try {
      window.sessionStorage.removeItem(CLE_DONNEES_DEMO);
    } catch {}
    window.location.assign("/dashboard");
  }
  function quitter() {
    window.__demoReset = true;
    try {
      window.sessionStorage.removeItem(CLE_DONNEES_DEMO);
    } catch {}
    quitterDemo();
    window.location.assign("/demo");
  }

  return (
    <div className="demo-bandeau" role="status">
      <span className="demo-bandeau-point" />
      <span className="demo-bandeau-texte">{t("demo.bandeau")}</span>
      <button type="button" className="admin-icon-btn" onClick={recommencer}>
        {t("demo.recommencer")}
      </button>
      <button type="button" className="admin-icon-btn" onClick={quitter}>
        {t("demo.quitter")}
      </button>
    </div>
  );
}
