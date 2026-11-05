"use client";

import { useEffect, useState } from "react";
import { genererCode, secondesRestantes } from "@/lib/codesGozly";
import { useT } from "@/components/LangProvider";

// Le code à 6 chiffres de la méthode « App Gozly » avec sa barre de temps (change toutes les 30 secondes).
// Calculé sur l'appareil, sans aucune requête.
export default function CodeVivant({ secret }) {
  const { t } = useT();
  const [code, setCode] = useState("");
  const [reste, setReste] = useState(30);

  useEffect(() => {
    if (!secret) return;
    let ignore = false;
    let dernierePeriode = -1;
    async function tic() {
      const maintenant = Date.now();
      setReste(secondesRestantes(maintenant));
      const periode = Math.floor(maintenant / 30000);
      if (periode !== dernierePeriode) {
        dernierePeriode = periode;
        const c = await genererCode(secret, maintenant);
        if (!ignore) setCode(c);
      }
    }
    tic();
    const id = setInterval(tic, 1000);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, [secret]);

  return (
    <div className="da-code-vivant-int">
      <div className="da-code-grand">{code ? `${code.slice(0, 3)} ${code.slice(3)}` : "--- ---"}</div>
      <div className="da-barre">
        <span style={{ width: `${(reste / 30) * 100}%` }} className={reste <= 5 ? "bientot" : ""} />
      </div>
      <p className="section-hint">{t("Nouveau code dans {n} s", { n: reste })}</p>
    </div>
  );
}
