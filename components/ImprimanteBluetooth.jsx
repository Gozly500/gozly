"use client";

import { useEffect, useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";
import { construireBonTest } from "@/lib/impressionCommandes";
import { appareilsJumeles, choisirImprimante, demanderPermissionBluetooth, etatPont, imprimerXml } from "@/lib/impressionLocale";

// Choix de l'imprimante Bluetooth de la tablette (app Android du kiosque) : liste des appareils jumelés,
// choix de l'imprimante et bon de test. Ne s'affiche que dans l'app (voir pontImprimante).
export default function ImprimanteBluetooth({ entrepriseId, onClose }) {
  const { t } = useLangue();
  const [etat, setEtat] = useState(() => etatPont());
  const [appareils, setAppareils] = useState([]);
  const [test, setTest] = useState(null); // null | "en_cours" | { type: "ok" | "err", text }

  function actualiser() {
    const e = etatPont();
    setEtat(e);
    setAppareils(e?.permission ? appareilsJumeles() : []);
  }

  useEffect(() => {
    actualiser();
    // La permission est accordée dans une fenêtre du système : on relit l'état quelques fois après la demande.
    const id = setInterval(actualiser, 1500);
    return () => clearInterval(id);
  }, []);

  function choisir(adresse) {
    choisirImprimante(adresse);
    actualiser();
  }

  async function imprimerTest() {
    setTest("en_cours");
    const resultat = await imprimerXml(construireBonTest("Gozly"));
    setTest(resultat === "ok" ? { type: "ok", text: t("kq.imp.testOk") } : { type: "err", text: t("kq.imp.erreur", { erreur: resultat }) });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: "520px", width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("kq.imp.titre")}</h3>
          <button className="admin-icon-btn" onClick={onClose}>
            {t("kq.imp.fermer")}
          </button>
        </div>

        <p className="section-hint">{t("kq.imp.intro")}</p>

        {!etat?.permission ? (
          <>
            <p className="section-hint">{t("kq.imp.permission")}</p>
            <button className="submit-btn" onClick={demanderPermissionBluetooth}>
              {t("kq.imp.autoriser")}
            </button>
          </>
        ) : (
          <>
            {appareils.length === 0 ? (
              <p className="section-hint">{t("kq.imp.aucun")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "12px 0" }}>
                {appareils.map((a) => {
                  const choisi = etat.choisi?.adresse === a.adresse;
                  return (
                    <button
                      key={a.adresse}
                      type="button"
                      className="admin-icon-btn"
                      style={choisi ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)", justifyContent: "space-between" } : { justifyContent: "space-between" }}
                      onClick={() => choisir(a.adresse)}
                    >
                      <span>{a.nom || a.adresse}</span>
                      {choisi && <span>{t("kq.imp.choisie")}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="admin-icon-btn" onClick={actualiser}>
                {t("kq.imp.actualiser")}
              </button>
              {etat.choisi && (
                <button className="submit-btn" disabled={test === "en_cours"} onClick={imprimerTest}>
                  {test === "en_cours" ? t("kq.imp.testEnCours") : t("kq.imp.tester")}
                </button>
              )}
            </div>
            {test && test !== "en_cours" && <p className={`settings-msg ${test.type}`}>{test.text}</p>}
          </>
        )}
      </div>
    </div>
  );
}
