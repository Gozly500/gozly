"use client";

import { useT } from "@/components/LangProvider";

// Base de l'espace développeur (comptes approuvés). Les apps viendront ici : fiches, état, installations.
export default function TableauDeveloppeur() {
  const { t } = useT();
  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      <h2>{t("Espace développeur")}</h2>

      <section style={{ marginTop: "24px" }}>
        <h3>{t("Mes apps")}</h3>
        <div className="admin-list">
          <div className="admin-row">
            <div className="admin-row-main">
              <div className="admin-row-sub">{t("Aucune app pour l'instant.")}</div>
            </div>
          </div>
        </div>
        <p className="panel-hint">{t("La création d'apps arrive bientôt.")}</p>
      </section>
    </div>
  );
}
