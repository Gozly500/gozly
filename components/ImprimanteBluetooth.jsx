"use client";

import { useEffect, useState } from "react";
import { useLangue } from "@/components/moi/LangueContext";
import { construireBonTest } from "@/lib/impressionCommandes";
import { appareilsJumeles, choisirImprimante, demanderPermissionBluetooth, etatPont, imprimerXml } from "@/lib/impressionLocale";

// Réglage de l'imprimante Bluetooth de la tablette (Réglages du kiosque, dans l'app Android seulement) :
// l'imprimante choisie reste la même tant qu'on n'en choisit pas une autre, et c'est elle qui imprime tous les bons.
export default function ImprimanteBluetooth() {
  const { t } = useLangue();
  const [etat, setEtat] = useState(null);
  const [appareils, setAppareils] = useState([]);
  const [test, setTest] = useState(null); // null | "en_cours" | { type: "ok" | "err", text }

  function actualiser() {
    const e = etatPont();
    setEtat(e);
    setAppareils(e?.permission ? appareilsJumeles() : []);
  }

  useEffect(() => {
    actualiser();
    // La permission est accordée dans une fenêtre du système : on relit l'état régulièrement.
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

  if (!etat) return null;

  return (
    <div style={{ marginBottom: "22px" }}>
      <h3 style={{ marginBottom: "4px" }}>{t("kq.imp.titre")}</h3>
      <p className="panel-hint">{etat.choisi ? `${t("kq.imp.choisie")} : ${etat.choisi.nom}` : t("kq.imp.aucune")}</p>

      {!etat.permission ? (
        <button className="submit-btn" onClick={demanderPermissionBluetooth}>
          {t("kq.imp.autoriser")}
        </button>
      ) : (
        <>
          {appareils.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "12px 0" }}>
              {appareils.map((a) => {
                const choisi = etat.choisi?.adresse === a.adresse;
                return (
                  <button
                    key={a.adresse}
                    type="button"
                    className="admin-icon-btn"
                    style={choisi ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
                    onClick={() => choisir(a.adresse)}
                  >
                    {a.nom || a.adresse}
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
  );
}
