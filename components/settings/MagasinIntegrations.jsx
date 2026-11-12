"use client";

import { useEffect, useRef, useState } from "react";
import { IconLoupe } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import LogoIntegration from "@/components/settings/LogoIntegration";
import { catalogue, CATEGORIES_INTEGRATIONS, categorieDe, sansAccents } from "@/lib/integrationsCatalogue";

// Le « magasin » : toutes les intégrations sous forme de cases, avec recherche et filtre par catégorie.
// Installer une intégration la fait apparaître dans la barre latérale (sous sa catégorie).
export default function MagasinIntegrations({ installees, onInstaller, onRetirer, onOuvrir, occupe = {} }) {
  const { t } = useT();
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState("toutes");
  // Animation d'installation, par intégration : "charge" (~1,5 s) puis "ok" (coche animée ~1,3 s).
  const [anim, setAnim] = useState({});
  const [erreur, setErreur] = useState(null);
  const minuteries = useRef([]);
  useEffect(() => () => minuteries.current.forEach(clearTimeout), []);

  function lancerInstallation(i) {
    setErreur(null);
    setAnim((a) => ({ ...a, [i.id]: "charge" }));
    minuteries.current.push(
      setTimeout(async () => {
        const res = await Promise.resolve(onInstaller(i)).catch(() => ({ ok: false }));
        if (res && res.ok === false) {
          setErreur(res.error || t("Impossible d'installer cette intégration."));
          setAnim((a) => {
            const { [i.id]: _, ...reste } = a;
            return reste;
          });
          return;
        }
        setAnim((a) => ({ ...a, [i.id]: "ok" }));
        minuteries.current.push(
          setTimeout(
            () =>
              setAnim((a) => {
                const { [i.id]: _, ...reste } = a;
                return reste;
              }),
            1300
          )
        );
      }, 1500)
    );
  }

  const q = sansAccents(recherche.trim());
  const visibles = catalogue().filter((i) => {
    if (categorie !== "toutes" && i.categorie !== categorie) return false;
    if (!q) return true;
    return sansAccents(`${i.nom} ${i.description} ${categorieDe(i.categorie)?.label}`).includes(q);
  });

  return (
    <div>
      <h2>{t("Magasin d'intégrations")}</h2>

      {erreur && <p className="settings-msg err">{erreur}</p>}

      <div className="magasin-recherche">
        <IconLoupe className="gozly-icon" />
        <input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={t("Rechercher une intégration (Wix, OneDrive...)")}
          aria-label={t("Rechercher une intégration")}
        />
      </div>

      <div className="magasin-filtres" role="group" aria-label={t("Catégories")}>
        {[{ id: "toutes", label: "Toutes" }, ...CATEGORIES_INTEGRATIONS].map((c) => (
          <button key={c.id} type="button" className={`magasin-filtre${categorie === c.id ? " actif" : ""}`} aria-pressed={categorie === c.id} onClick={() => setCategorie(c.id)}>
            {t(c.label)}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="section-hint">{t("Aucune intégration ne correspond à ta recherche.")}</p>
      ) : (
        <div className="magasin-grille">
          {visibles.map((i) => {
            const etape = anim[i.id]; // undefined | "charge" | "ok"
            const installee = installees.includes(i.id) && etape !== "charge";
            return (
              <div key={i.id} className={`magasin-carte${installee ? " installee" : ""}${i.disponible ? "" : " bientot"}`}>
                {etape === "ok" && (
                  <div className="magasin-succes" role="status">
                    <svg viewBox="0 0 52 52" className="magasin-coche" aria-hidden="true">
                      <circle className="magasin-coche-cercle" cx="26" cy="26" r="23" fill="none" />
                      <path className="magasin-coche-trait" fill="none" d="M15 27l8 8 14-16" />
                    </svg>
                    <strong>{t("{nom} est installée !", { nom: i.nom })}</strong>
                  </div>
                )}
                <div className="magasin-carte-tete">
                  <LogoIntegration i={i} />
                  <div className="magasin-carte-titre">
                    <strong>{i.nom}</strong>
                    <span>
                      {t(categorieDe(i.categorie)?.label)} · {t("Par {nom}", { nom: i.developpeur || "Gozly" })}
                    </span>
                  </div>
                </div>
                <p className="magasin-carte-desc">{t(i.description)}</p>
                <div className="magasin-carte-pied">
                  {!i.disponible ? (
                    <span className="ih-hint">{t("Bientôt disponible")}</span>
                  ) : etape === "charge" ? (
                    <button type="button" className="submit-btn magasin-installer" disabled>
                      <span className="magasin-spinner" aria-hidden="true" /> {t("Installation...")}
                    </button>
                  ) : installee ? (
                    <>
                      <button type="button" className="admin-icon-btn" onClick={() => onOuvrir(i)}>
                        {t("Ouvrir")}
                      </button>
                      <button type="button" className="magasin-retirer" onClick={() => onRetirer(i)} disabled={!!occupe[i.id]}>
                        {t("Retirer")}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="submit-btn magasin-installer" onClick={() => lancerInstallation(i)} disabled={!!occupe[i.id]}>
                      {t("Installer")}
                    </button>
                  )}
                  {installee && etape !== "ok" && <span className="admin-status-pill active">{t("Installée")}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
