"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";
import ScategoriesGame from "@/components/ScategoriesGame";
import ScategoriesJoueur from "@/components/ScategoriesJoueur";
import { normaliserCode } from "@/lib/scategoriesRoom";

// Page du jeu : l'hôte/solo (ScategoriesGame) ou un joueur qui rejoint une partie avec un code.
// ?code=ABCD dans l'adresse ouvre directement l'écran joueur.
export default function ScategoriesApp() {
  const { t } = useT();
  const [mode, setMode] = useState("jeu"); // jeu | joueur
  const [codeInitial, setCodeInitial] = useState("");

  useEffect(() => {
    const c = normaliserCode(new URLSearchParams(window.location.search).get("code"));
    if (c) {
      setCodeInitial(c);
      setMode("joueur");
    }
  }, []);

  function retour() {
    setMode("jeu");
    setCodeInitial("");
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {}
  }

  if (mode === "joueur") return <ScategoriesJoueur codeInitial={codeInitial} onQuitter={retour} />;

  return (
    <>
      <div className="scat-rejoindre-bandeau">
        <span>{t("scat.aUnCode")}</span>
        <button type="button" className="scat-btn" onClick={() => setMode("joueur")}>
          {t("scat.rejoindre")}
        </button>
      </div>
      <ScategoriesGame />
    </>
  );
}
