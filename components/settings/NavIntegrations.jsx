"use client";

import { IconIntegration } from "@/components/icons/GozlyIcons";
import { IconFlecheGauche } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import { categoriesInstallees } from "@/lib/integrationsCatalogue";

// Second niveau de la barre latérale des paramètres : le magasin toujours en premier, puis seulement les catégories où une intégration est installée.
export default function NavIntegrations({ vue, installees, onChoisir, onRetour }) {
  const { t } = useT();
  const categories = categoriesInstallees(installees);
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
      {categories.map((c) => (
        <button key={c.id} type="button" className={`settings-nav-item${vue === c.id ? " active" : ""}`} onClick={() => onChoisir(c.id)}>
          {t(c.label)}
        </button>
      ))}
    </>
  );
}
