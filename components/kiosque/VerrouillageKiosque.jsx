"use client";

import { useEffect, useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";
import { dansAppKiosque, deverrouillerAppareil, etatAppareil, verrouillerAppareil } from "@/lib/appareilKiosque";

// Verrouillage de la tablette (Réglages du kiosque, dans l'app Android seulement) : « épingle » l'app pour qu'on ne puisse
// plus la quitter sans le geste de déverrouillage de la tablette.
export default function VerrouillageKiosque() {
  const { t } = useLangue();
  const [dansApp, setDansApp] = useState(false);
  const [etat, setEtat] = useState(null);

  useEffect(() => {
    setDansApp(dansAppKiosque());
    const lire = () => setEtat(etatAppareil());
    lire();
    // Android confirme l'épinglage dans une fenêtre du système : on relit l'état régulièrement.
    const id = setInterval(lire, 1500);
    return () => clearInterval(id);
  }, []);

  if (!dansApp) return null;

  return (
    <div style={{ marginBottom: "22px" }}>
      <h3 style={{ marginBottom: "4px" }}>{t("kq.verrou.titre")}</h3>
      {!etat ? (
        // L'app est ouverte mais sa version est trop ancienne pour se verrouiller.
        <p className="panel-hint">{t("kq.verrou.maj")}</p>
      ) : (
        <>
          <p className="panel-hint">{etat.verrouille ? t("kq.verrou.actif") : t("kq.verrou.inactif")}</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {etat.verrouille ? (
              <button className="admin-icon-btn" onClick={() => { deverrouillerAppareil(); setTimeout(() => setEtat(etatAppareil()), 300); }}>
                {t("kq.verrou.deverrouiller")}
              </button>
            ) : (
              <button className="submit-btn" onClick={verrouillerAppareil}>
                {t("kq.verrou.verrouiller")}
              </button>
            )}
          </div>
          <p className="panel-hint" style={{ marginTop: "8px" }}>{t("kq.verrou.aide")}</p>
        </>
      )}
    </div>
  );
}
