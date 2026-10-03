"use client";

import { useState } from "react";
import { useGestion } from "@/components/gestion/GestionShell";
import HoraireMobile from "@/components/gestion/HoraireMobile";
import FeuilleTempsMobile from "@/components/gestion/FeuilleTempsMobile";

// Page "Horaire" de l'app gestionnaire : l'horaire (lecture seule) et la feuille de temps.
export default function HorairePageGestion() {
  const { peutVoirFeuille } = useGestion();
  const [vue, setVue] = useState("horaire");

  return (
    <div>
      <h2 style={{ marginBottom: "12px" }}>Horaire</h2>
      {peutVoirFeuille && (
        <div className="gestion-sous-onglets">
          <button type="button" className={vue === "horaire" ? "active" : ""} onClick={() => setVue("horaire")}>
            Horaire
          </button>
          <button type="button" className={vue === "feuille" ? "active" : ""} onClick={() => setVue("feuille")}>
            Feuille de temps
          </button>
        </div>
      )}
      {vue === "feuille" && peutVoirFeuille ? <FeuilleTempsMobile /> : <HoraireMobile />}
    </div>
  );
}
