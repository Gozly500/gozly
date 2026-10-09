"use client";

import { useEffect } from "react";
import Link from "next/link";
import PointageKioskContent from "@/components/PointageKioskContent";
import PlanningKioskContent from "@/components/PlanningKioskContent";
import InventaireKioskContent from "@/components/InventaireKioskContent";
import CommandesKioskContent from "@/components/CommandesKioskContent";
import { useLangue } from "@/components/moi/LangueContext";
import { IconFlecheGauche } from "@/components/icons/Pictogrammes";

const ECRANS = {
  pointage: PointageKioskContent,
  taches: PlanningKioskContent,
  inventaire: InventaireKioskContent,
  commandes: CommandesKioskContent,
};

// Petit bouton rond discret, collé dans un coin (retour à gauche, langue à droite).
const BOUTON_COIN = {
  position: "fixed",
  bottom: "4px",
  zIndex: 50,
  opacity: 0.55,
  width: "44px",
  height: "44px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  background: "rgba(255,255,255,.12)",
  color: "var(--text-dim, #aaa)",
  fontSize: "22px",
  textDecoration: "none",
};

// Affiche un écran kiosque dans l'app tablette (même contenu que /dashboard/...-kiosk),
// garde l'écran allumé, et laisse deux petits boutons discrets : retour à la liste et FR / EN.
export default function KiosqueEcran({ id }) {
  const Ecran = ECRANS[id];
  const { t, langue, setLangue } = useLangue();

  useEffect(() => {
    let verrou = null;
    let annule = false;

    async function demander() {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") {
          const v = await navigator.wakeLock.request("screen");
          if (annule) v.release();
          else verrou = v;
        }
      } catch {}
    }
    demander();
    document.addEventListener("visibilitychange", demander);

    return () => {
      annule = true;
      document.removeEventListener("visibilitychange", demander);
      try {
        verrou?.release();
      } catch {}
    };
  }, []);

  if (!Ecran) return null;

  return (
    <>
      <Ecran />
      <Link href="/kiosque" aria-label={t("kq.retourListe")} style={{ ...BOUTON_COIN, left: "4px" }}>
        <IconFlecheGauche className="gozly-icon" />
      </Link>
      {/* Montre la langue vers laquelle on bascule : « EN » quand l'écran est en français. */}
      <button
        type="button"
        aria-label={t("kq.langue.aria")}
        onClick={() => setLangue(langue === "fr" ? "en" : "fr")}
        style={{ ...BOUTON_COIN, right: "4px", border: 0, cursor: "pointer", fontSize: "14px", fontWeight: 700 }}
      >
        {langue === "fr" ? "EN" : "FR"}
      </button>
    </>
  );
}
