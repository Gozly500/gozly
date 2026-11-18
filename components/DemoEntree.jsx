"use client";

import { useT } from "@/components/LangProvider";
import { activerDemo, CLE_DONNEES_DEMO } from "@/lib/demo/actif";
import { IconFlecheDroite } from "@/components/icons/Pictogrammes";

// Bouton « Commencer la démo » : repart toujours d'une démo neuve (les données fictives sont recréées), active le
// mode démo pour cet onglet, puis ouvre le tableau de bord. Rechargement complet : le mode démo est lu au démarrage.
export default function DemoEntree() {
  const { t } = useT();
  function commencer() {
    try {
      window.sessionStorage.removeItem(CLE_DONNEES_DEMO);
    } catch {}
    activerDemo();
    window.location.assign("/dashboard");
  }
  return (
    <button type="button" className="btn-pill-dark" onClick={commencer}>
      {t("demo.btn")} <IconFlecheDroite className="gozly-icon-inline" />
    </button>
  );
}
