"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import EnteteIntegration from "@/components/settings/EnteteIntegration";
import { catalogue } from "@/lib/integrationsCatalogue";
import { PERMISSIONS_APP } from "@/lib/appsDeveloppeur";

const LIBELLES = Object.fromEntries(PERMISSIONS_APP.flatMap((m) => m.actions.map((a) => [a.id, a.label])));

// Page d'une app de développeur installée : sa fiche publique. La connexion à l'app n'est pas encore disponible.
export default function PageAppTierce({ id, entrepriseId }) {
  const { t, lang } = useT();
  const [urlPage, setUrlPage] = useState(null);
  const app = catalogue().find((i) => i.id === id);
  const d = app?.details;

  // Page de l'app (iframe) : adresse signée, avec le thème du client.
  useEffect(() => {
    if (!d?.a_page || !entrepriseId) return;
    let ignore = false;
    (async () => {
      let theme = "sombre";
      let accent = "#3a37d1";
      try {
        theme = localStorage.getItem("gozly-theme") === "clair" ? "clair" : "sombre";
        const a = localStorage.getItem("gozly-accent");
        const couleurs = { gozly: "#3a37d1", vert: "#1fa86c", rose: "#e0407f", sunset: "#e8763f" };
        if (couleurs[a]) accent = couleurs[a];
      } catch {}
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/integrations/app-page", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ entrepriseId, integrationId: id, theme, accent, lang }),
      });
      const json = await res.json().catch(() => ({}));
      if (!ignore && res.ok) setUrlPage(json.url);
    })();
    return () => {
      ignore = true;
    };
  }, [id, entrepriseId, d?.a_page]);

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
        {lienSur(d.url_externe) && (
          <div>
            <a href={d.url_externe} target="_blank" rel="noopener noreferrer" className="submit-btn" style={{ display: "inline-block", textDecoration: "none" }}>
              {t("Ouvrir {nom}", { nom: app.nom })}
            </a>
          </div>
        )}
        {urlPage ? (
          <iframe
            src={urlPage}
            title={app.nom}
            sandbox="allow-scripts allow-forms allow-same-origin"
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "640px", border: 0, background: "transparent" }}
          />
        ) : lienSur(d.url_externe) ? null : (
          <p className="panel-hint" style={{ margin: 0 }}>{t("Connexion bientôt disponible.")}</p>
        )}
      </div>
    </div>
  );
}
