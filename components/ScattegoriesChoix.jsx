"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/components/LangProvider";
import { normaliserCode } from "@/lib/scattegoriesRoom";

// Page d'entrée de Scattegories : on choisit d'animer la partie (maître du jeu) ou de rejoindre avec un code.
export default function ScattegoriesChoix() {
  const { t } = useT();
  const router = useRouter();
  const [code, setCode] = useState("");

  // Ancien lien /scattegories?code=XXXX : on envoie directement vers l'écran joueur.
  useEffect(() => {
    const c = normaliserCode(new URLSearchParams(window.location.search).get("code"));
    if (c) router.replace(`/scattegories/jouer?code=${c}`);
  }, [router]);

  function rejoindre(e) {
    e.preventDefault();
    const c = normaliserCode(code);
    router.push(c ? `/scattegories/jouer?code=${c}` : "/scattegories/jouer");
  }

  return (
    <div className="scat-choix">
      <Link href="/scattegories/maitre" className="scat-choix-carte scat-choix-maitre">
        <span className="scat-choix-icone" aria-hidden="true">
          🎲
        </span>
        <h2>{t("scat.maitre")}</h2>
        <p>{t("scat.maitreSous")}</p>
        <span className="scat-choix-go">{t("scat.commencer")} →</span>
      </Link>

      <form className="scat-choix-carte scat-choix-joueur" onSubmit={rejoindre}>
        <span className="scat-choix-icone" aria-hidden="true">
          📱
        </span>
        <h2>{t("scat.rejoindre")}</h2>
        <p>{t("scat.joueurSous")}</p>
        <input className="scat-champ scat-champ-code" value={code} onChange={(e) => setCode(normaliserCode(e.target.value))} placeholder="ABCD" autoCapitalize="characters" autoComplete="off" maxLength={4} aria-label={t("scat.codeLabel")} />
        <button type="submit" className="scat-btn scat-btn-go">
          {t("scat.rejoindreBtn")}
        </button>
      </form>
    </div>
  );
}
