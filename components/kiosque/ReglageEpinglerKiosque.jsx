"use client";

import { useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";
import { useEntrepriseKiosque } from "@/components/kiosque/useEntrepriseKiosque";
import { KIOSQUES } from "@/lib/kiosques";
import { epinglerKiosque } from "@/lib/kiosqueEpingle";

// Réglages du kiosque : épingler la tablette sur un seul kiosque. Réglage d'administrateur : pas de bouton pour désépingler,
// il faut quitter l'application puis revenir (sur Windows en mode borne : redémarrer).
export default function ReglageEpinglerKiosque() {
  const { t } = useLangue();
  const { modules } = useEntrepriseKiosque();
  const [choix, setChoix] = useState(null);
  const disponibles = KIOSQUES.filter((k) => modules.includes(k.module));

  if (disponibles.length === 0) return null;

  return (
    <div style={{ marginBottom: "22px" }}>
      <h3 style={{ marginBottom: "4px" }}>{t("kq.epingle.titre")}</h3>
      <p className="panel-hint">{t("kq.epingle.desc")}</p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
        {disponibles.map((k) => (
          <button
            key={k.id}
            type="button"
            className="admin-icon-btn"
            style={choix === k.id ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
            aria-pressed={choix === k.id}
            onClick={() => setChoix(k.id)}
          >
            {t(`kq.k.${k.id}.nom`)}
          </button>
        ))}
      </div>
      <button type="button" className="submit-btn" disabled={!choix} onClick={() => epinglerKiosque(choix)}>
        {t("kq.epingle.bouton")}
      </button>
      <p className="panel-hint" style={{ marginTop: "8px" }}>{t("kq.epingle.aide")}</p>
    </div>
  );
}
