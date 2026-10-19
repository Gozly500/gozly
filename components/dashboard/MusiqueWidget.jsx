"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sonosApi, ETATS_LECTURE } from "@/lib/sonosClient";
import { IconFlecheDroite } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";

// Widget « Musique en cours » : état des groupes Sonos, avec lecture / pause rapide.
export default function MusiqueWidget({ entrepriseId }) {
  const { t } = useT();
  const [etat, setEtat] = useState(null);

  async function charger() {
    const r = await sonosApi(`/api/sonos/etat?entrepriseId=${entrepriseId}`);
    setEtat(r.ok ? r.data : { erreur: true });
  }

  useEffect(() => {
    charger();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") charger();
    }, 15000);
    return () => clearInterval(id);
  }, [entrepriseId]);

  async function basculer(g) {
    await sonosApi("/api/sonos/commande", { method: "POST", body: { entrepriseId, action: g.etat === "PLAYING" ? "pause" : "lecture", groupeId: g.id } });
    setTimeout(charger, 700);
  }

  const lien = (
    <Link href="/dashboard/musique" className="admin-icon-btn" style={{ display: "inline-block", marginTop: "10px" }}>
      {t("Ouvrir la musique")}{" "}<IconFlecheDroite className="gozly-icon-inline" />
    </Link>
  );

  if (!etat) return <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>;
  if (!etat.lie || etat.expire) {
    return (
      <>
        <p className="widget-card-empty">{t("Aucun système Sonos lié.")}</p>
        {lien}
      </>
    );
  }
  if (etat.erreur || !etat.groupes?.length) {
    return (
      <>
        <p className="widget-card-empty">{t("Aucun haut-parleur trouvé.")}</p>
        {lien}
      </>
    );
  }

  return (
    <>
      <div className="admin-list">
        {etat.groupes.slice(0, 4).map((g) => (
          <div className="admin-row" key={g.id}>
            <div className="admin-row-main">
              <div className="admin-row-title">{g.nom}</div>
              <div className="admin-row-sub">
                {t(ETATS_LECTURE[g.etat] || "Arrêté")}
                {g.titre ? ` · ${g.titre}` : ""}
              </div>
            </div>
            <div className="admin-row-controls">
              <button type="button" className="admin-icon-btn" onClick={() => basculer(g)}>
                {g.etat === "PLAYING" ? t("Pause") : t("Lecture")}
              </button>
            </div>
          </div>
        ))}
      </div>
      {lien}
    </>
  );
}
