"use client";

import { useT } from "@/components/LangProvider";
import EnteteIntegration from "@/components/settings/EnteteIntegration";
import { catalogue } from "@/lib/integrationsCatalogue";
import { PERMISSIONS_APP } from "@/lib/appsDeveloppeur";

const LIBELLES = Object.fromEntries(PERMISSIONS_APP.flatMap((m) => m.actions.map((a) => [a.id, a.label])));

// Page d'une app de développeur installée : sa fiche publique. La connexion à l'app n'est pas encore disponible.
export default function PageAppTierce({ id }) {
  const { t } = useT();
  const app = catalogue().find((i) => i.id === id);
  const d = app?.details;
  if (!d) return null;
  const lienSur = (u) => String(u || "").toLowerCase().startsWith("https://");

  return (
    <div>
      <EnteteIntegration id={id} />
      <div className="settings-section" style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
        {d.description_longue && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{d.description_longue}</p>}
        <div>
          <strong>{t("Par {nom}", { nom: d.developpeur || "—" })}</strong>
          {" · "}
          {d.payant ? d.prix : t("Gratuit")}
        </div>
        {d.permissions?.length > 0 && (
          <div>
            <strong>{t("Permissions demandées")}</strong>
            <ul style={{ margin: "6px 0 0 18px" }}>
              {d.permissions.map((p) => (
                <li key={p}>{t(LIBELLES[p] || p)}</li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ color: "var(--text-dim)", fontSize: "13.5px" }}>
          {d.courriel_support}
          {lienSur(d.url_confidentialite) && (
            <>
              {" · "}
              <a href={d.url_confidentialite} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                {t("Politique de confidentialité")}
              </a>
            </>
          )}
        </div>
        <p className="panel-hint" style={{ margin: 0 }}>{t("Connexion bientôt disponible.")}</p>
      </div>
    </div>
  );
}
