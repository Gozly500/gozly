"use client";

import { IconIntegration } from "@/components/icons/GozlyIcons";
import { IconFlecheBas, IconFlecheGauche } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import { CATALOGUE_INTEGRATIONS, categoriesInstallees } from "@/lib/integrationsCatalogue";

// Second niveau de la barre latérale des paramètres : le magasin toujours en premier, puis les intégrations installées.
// Une catégorie qui n'a qu'une intégration installée affiche directement cette intégration ; avec deux ou plus, la catégorie
// devient un sous-menu qui les liste. `vue` = "magasin" ou l'id d'une intégration.
export default function NavIntegrations({ vue, installees, onChoisir, onRetour }) {
  const { t } = useT();
  const categories = categoriesInstallees(installees).map((c) => ({
    ...c,
    items: CATALOGUE_INTEGRATIONS.filter((i) => i.categorie === c.id && installees.includes(i.id)),
  }));
  return (
    <>
      <button type="button" className="settings-nav-item admin-nav-retour" onClick={onRetour}>
        <span className="icon">
          <IconFlecheGauche className="gozly-icon" />
        </span>{" "}
        {t("Retour")}
      </button>
      <button type="button" className={`settings-nav-item${vue === "magasin" ? " active" : ""}`} onClick={() => onChoisir("magasin")}>
        <span className="icon">
          <IconIntegration className="gozly-icon" />
        </span>{" "}
        {t("Magasin")}
      </button>
      {categories.map((c) => {
        if (c.items.length === 1) {
          const i = c.items[0];
          return (
            <button key={c.id} type="button" className={`settings-nav-item${vue === i.id ? " active" : ""}`} onClick={() => onChoisir(i.id)}>
              {t(i.nom)}
            </button>
          );
        }
        const ouvert = c.items.some((i) => i.id === vue);
        return (
          <div key={c.id} className="param-nav-groupe">
            <button
              type="button"
              className={`settings-nav-item${ouvert ? " param-nav-ouvert" : ""}`}
              aria-expanded={ouvert}
              onClick={() => !ouvert && onChoisir(c.items[0].id)}
            >
              <span className="param-nav-libelle">{t(c.label)}</span>
              <span className={`param-nav-fleche${ouvert ? " ouvert" : ""}`}>
                <IconFlecheBas className="gozly-icon-inline" />
              </span>
            </button>
            <div className={`param-nav-sous${ouvert ? " ouvert" : ""}`} aria-hidden={!ouvert}>
              <div className="param-nav-sous-int">
                {c.items.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    tabIndex={ouvert ? 0 : -1}
                    className={`settings-nav-item param-nav-sous-item${vue === i.id ? " active" : ""}`}
                    onClick={() => onChoisir(i.id)}
                  >
                    {t(i.nom)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
