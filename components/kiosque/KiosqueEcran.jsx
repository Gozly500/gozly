"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MusiqueKiosk from "@/components/kiosque/MusiqueKiosk";
import MusiqueEpingle, { reservePourMode } from "@/components/kiosque/MusiqueEpingle";
import { useEntrepriseKiosque } from "@/components/kiosque/useEntrepriseKiosque";
import BoutonEpingler from "@/components/kiosque/BoutonEpingler";
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
  musique: MusiqueKiosk,
};

const CLE_EPINGLE = "gozly-kiosque-musique"; // mémorisé sur la tablette : "off" | "compact" | "large"

// Petit bouton rond discret, collé dans un coin (retour à gauche, langue à droite).
const BOUTON_COIN = {
  position: "fixed",
  bottom: "4px",
  zIndex: 50,
  width: "44px",
  height: "44px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  // Couleurs pleines (mélange du texte et du fond) plutôt que de l'opacité, qui ferait voir les calques des icônes.
  background: "color-mix(in srgb, var(--text, #ffffff) 14%, var(--navy, #0d0d3f))",
  color: "color-mix(in srgb, var(--text, #ffffff) 62%, var(--navy, #0d0d3f))",
  fontSize: "22px",
  textDecoration: "none",
};

// Affiche un écran kiosque dans l'app tablette (même contenu que /dashboard/...-kiosk),
// garde l'écran allumé, et laisse deux petits boutons discrets : retour à la liste et FR / EN.
export default function KiosqueEcran({ id }) {
  const Ecran = ECRANS[id];
  const { t, langue, setLangue } = useLangue();
  const { entrepriseId, modules } = useEntrepriseKiosque();
  const [epingle, setEpingle] = useState("off");

  useEffect(() => {
    try {
      const m = localStorage.getItem(CLE_EPINGLE);
      if (m === "compact" || m === "large") setEpingle(m);
    } catch {}
  }, []);

  function changerEpingle(m) {
    setEpingle(m);
    try {
      localStorage.setItem(CLE_EPINGLE, m);
    } catch {}
  }

  // On épingle seulement depuis le kiosque Musique (bouton « Épingler »). Une fois épinglé (et le module Musique
  // actif), le lecteur se superpose aux autres kiosques, qui n'ont pas de bouton d'épinglage.
  const estMusique = id === "musique";
  const mode = !estMusique && modules.includes("musique") ? epingle : "off";

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
      {/* .kq-entree : le kiosque arrive en petit et grossit (voir useTransitionKiosque et globals.css) */}
      <div className="kq-entree" style={reservePourMode(mode)}>
        <Ecran />
      </div>
      {mode !== "off" && <MusiqueEpingle entrepriseId={entrepriseId} mode={mode} onMode={changerEpingle} />}
      <Link href="/kiosque" aria-label={t("kq.retourListe")} style={{ ...BOUTON_COIN, left: "4px" }}>
        <IconFlecheGauche className="gozly-icon" />
      </Link>
      {estMusique && <BoutonEpingler mode={epingle} onChoix={changerEpingle} />}
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
