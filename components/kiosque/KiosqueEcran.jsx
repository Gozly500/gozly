"use client";

import { useEffect } from "react";
import Link from "next/link";
import PointageKioskContent from "@/components/PointageKioskContent";
import PlanningKioskContent from "@/components/PlanningKioskContent";
import InventaireKioskContent from "@/components/InventaireKioskContent";
import CommandesKioskContent from "@/components/CommandesKioskContent";

const ECRANS = {
  pointage: PointageKioskContent,
  taches: PlanningKioskContent,
  inventaire: InventaireKioskContent,
  commandes: CommandesKioskContent,
};

// Affiche un écran kiosque dans l'app tablette (même contenu que /dashboard/...-kiosk),
// garde l'écran allumé, et laisse un petit bouton discret pour revenir à la liste.
export default function KiosqueEcran({ id }) {
  const Ecran = ECRANS[id];

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
      <Link
        href="/kiosque"
        aria-label="Retour à la liste des kiosques"
        style={{
          position: "fixed",
          bottom: "4px",
          left: "4px",
          zIndex: 50,
          opacity: 0.4,
          width: "30px",
          height: "30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          background: "rgba(255,255,255,.12)",
          color: "var(--text-dim, #aaa)",
          fontSize: "16px",
          textDecoration: "none",
        }}
      >
        ←
      </Link>
    </>
  );
}
