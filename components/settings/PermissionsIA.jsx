"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/components/LangProvider";
import { MODULES_IA, permissionsParDefaut } from "@/lib/iaModules";

async function appeler(corps) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/ia/reglages", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token}` },
    body: JSON.stringify(corps),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: json };
}

function Interrupteur({ coche, onChange, label }) {
  return (
    <span className="switch">
      <input type="checkbox" checked={coche} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="switch-track"></span>
      <span className="switch-thumb"></span>
    </span>
  );
}

// Ce que les assistants IA ont le droit de faire : un module à la fois (onglets), avec un interrupteur pour l'ouvrir ou le fermer
// et une liste courte d'actions. S'applique à toutes les connexions, en direct. Seul le propriétaire y a accès.
export default function PermissionsIA({ entrepriseId }) {
  const { t } = useT();
  const [etat, setEtat] = useState("chargement"); // chargement | pret | refuse
  const [configure, setConfigure] = useState(true);
  const [permissions, setPermissions] = useState(permissionsParDefaut());
  const [enregistrees, setEnregistrees] = useState(null);
  const [moduleOuvert, setModuleOuvert] = useState(MODULES_IA[0].id);
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (entrepriseId) charger();
  }, [entrepriseId]);

  async function charger() {
    const { ok, data } = await appeler({ action: "lire", entrepriseId });
    if (!ok) return setEtat("refuse");
    setPermissions(data.permissions);
    setEnregistrees(JSON.stringify(data.permissions));
    setConfigure(data.configure !== false);
    setEtat("pret");
  }

  function changerModule(id, actif) {
    setPermissions((p) => ({ ...p, [id]: { ...p[id], actif } }));
    setMsg(null);
  }

  function changerAction(id, action, valeur) {
    setPermissions((p) => ({ ...p, [id]: { ...p[id], [action]: valeur } }));
    setMsg(null);
  }

  async function enregistrer() {
    const avant = enregistrees ? JSON.parse(enregistrees) : null;
    const publierActive = permissions.horaire.actif && permissions.horaire.publier;
    const publierAvant = avant ? avant.horaire.actif && avant.horaire.publier : false;
    if (publierActive && !publierAvant) {
      const ok = window.confirm(
        t("Tu permets à l'IA de PUBLIER l'horaire : les employés verront les quarts et recevront une notification dès qu'elle le fait, sur ta demande. Confirmer?")
      );
      if (!ok) return;
    }
    setOccupe(true);
    setMsg(null);
    const { ok, data } = await appeler({ action: "enregistrer", entrepriseId, permissions });
    setOccupe(false);
    if (!ok) return setMsg({ type: "err", text: data.error || t("Échec") });
    setPermissions(data.permissions);
    setEnregistrees(JSON.stringify(data.permissions));
    setMsg({ type: "ok", text: t("Enregistré. C'est actif tout de suite (dans une nouvelle conversation si ton assistant garde sa liste d'outils).") });
  }

  if (etat === "chargement") return <p className="section-hint">{t("Chargement...")}</p>;
  if (etat === "refuse") return <p className="section-hint">{t("Seul le propriétaire de l'entreprise peut gérer les permissions de l'IA.")}</p>;

  const modifie = JSON.stringify(permissions) !== enregistrees;
  const m = MODULES_IA.find((x) => x.id === moduleOuvert);
  const p = permissions[m.id];

  return (
    <div>
      {!configure && (
        <p className="settings-msg err">
          {t("Les réglages ne peuvent pas encore être enregistrés (le SQL « ia_reglages » n'est pas exécuté). En attendant, tout est permis sauf la publication de l'horaire.")}
        </p>
      )}

      <div className="page-onglets sous" role="tablist" aria-label={t("Modules")}>
        {MODULES_IA.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={moduleOuvert === x.id} className={`page-onglet${moduleOuvert === x.id ? " actif" : ""}`} onClick={() => setModuleOuvert(x.id)}>
            <span className={`ia-point${permissions[x.id].actif ? " on" : ""}`} aria-hidden="true" />
            {t(x.label)}
          </button>
        ))}
      </div>

      <div className="ia-droit" style={{ marginTop: "14px" }}>
        <div className="ia-droit-tete">
          <div>
            <strong>{p.actif ? t("Ouvert à l'IA") : t("Fermé à l'IA")}</strong>
            <p className="section-hint" style={{ margin: "2px 0 0" }}>{t(m.resume)}</p>
          </div>
          <Interrupteur coche={p.actif} onChange={(v) => changerModule(m.id, v)} label={t(m.label)} />
        </div>

        {p.actif && (
          <div className="ia-actions">
            {m.actions.map((a) => (
              <label key={a.id} className={`ia-action${a.sensible ? " sensible" : ""}`}>
                <Interrupteur coche={p[a.id]} onChange={(v) => changerAction(m.id, a.id, v)} label={t(a.label)} />
                <span>
                  <span className="ia-action-nom">{t(a.label)}</span>
                  {a.detail && <span className="section-hint" style={{ display: "block", margin: 0 }}>{t(a.detail)}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <details className="ia-jamais">
        <summary>{t("Ce que l'IA ne fait jamais")}</summary>
        <ul>
          <li>{t("Agir de son propre chef : elle n'agit que sur demande dans son assistant.")}</li>
          <li>{t("Voir les salaires, les NIP ni les coordonnées des employés.")}</li>
          <li>{t("Supprimer ce qu'une personne a créé, ni un quart déjà publié.")}</li>
        </ul>
      </details>

      {(modifie || msg) && (
        <div className="ia-barre-enregistrer">
          {msg && !modifie ? (
            <span className={`settings-msg ${msg.type}`} style={{ margin: 0 }}>{msg.text}</span>
          ) : (
            <>
              <span className="section-hint" style={{ margin: 0 }}>{t("Changements non enregistrés")}</span>
              <button type="button" className="admin-icon-btn" onClick={() => setPermissions(JSON.parse(enregistrees))} disabled={occupe}>
                {t("Annuler")}
              </button>
              <button type="button" className="submit-btn" onClick={enregistrer} disabled={occupe}>
                {occupe ? "..." : t("Enregistrer")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
