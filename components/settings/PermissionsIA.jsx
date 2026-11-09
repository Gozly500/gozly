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

// Ce que les assistants IA ont le droit de faire dans l'entreprise : on ouvre ou on ferme chaque module, puis on règle les actions
// permises dans chacun. S'applique à toutes les connexions, en direct. Seul le propriétaire y a accès.
export default function PermissionsIA({ entrepriseId }) {
  const { t } = useT();
  const [etat, setEtat] = useState("chargement"); // chargement | pret | refuse
  const [configure, setConfigure] = useState(true);
  const [permissions, setPermissions] = useState(permissionsParDefaut());
  const [enregistrees, setEnregistrees] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (entrepriseId) charger();
  }, [entrepriseId]);

  async function charger() {
    const { ok, status, data } = await appeler({ action: "lire", entrepriseId });
    if (status === 403) return setEtat("refuse");
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
    setMsg({ type: "ok", text: t("Permissions enregistrées. Elles s'appliquent tout de suite aux assistants connectés (dans une nouvelle conversation si l'assistant garde la liste de ses outils).") });
  }

  if (etat === "chargement") return <p className="section-hint">{t("Chargement...")}</p>;
  if (etat === "refuse") return <p className="section-hint">{t("Seul le propriétaire de l'entreprise peut gérer les permissions de l'IA.")}</p>;

  const modifie = JSON.stringify(permissions) !== enregistrees;

  return (
    <div className="integration-item">
      <div className="integration-header open">
        <span className="ih-label">{t("Permissions de l'IA")}</span>
      </div>
      <div className="integration-body">
        <p className="section-hint">
          {t("Choisis les modules que tes assistants IA peuvent utiliser, puis ce qu'ils ont le droit d'y faire. Ça vaut pour toutes les connexions de ton entreprise, sans avoir à les reconnecter. Les employés, eux, ne voient jamais l'IA : ils voient seulement ce qui est publié.")}
        </p>

        {!configure && (
          <p className="settings-msg err">
            {t("Les réglages ne peuvent pas encore être enregistrés (le SQL « ia_reglages » n'est pas exécuté). En attendant, les valeurs par défaut s'appliquent : tout est permis sauf la publication de l'horaire.")}
          </p>
        )}

        <div className="ia-droits" style={{ marginTop: "12px" }}>
          {MODULES_IA.map((m) => {
            const p = permissions[m.id];
            return (
              <div key={m.id} className="ia-droit">
                <div className="ia-droit-tete">
                  <div>
                    <strong>{t(m.label)}</strong>
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
                {!p.actif && <p className="section-hint" style={{ margin: 0 }}>{t("Fermé : l'IA ne voit rien de ce module.")}</p>}
              </div>
            );
          })}
        </div>

        <div className="abo-carte" style={{ margin: "14px 0" }}>
          <strong>{t("Dans tous les cas, l'IA ne pourra jamais :")}</strong>
          <ul style={{ margin: "6px 0 0 18px" }}>
            <li>{t("agir de son propre chef : elle n'agit que quand quelqu'un le lui demande dans son assistant")}</li>
            <li>{t("voir les salaires, les NIP ni les coordonnées de tes employés")}</li>
            <li>{t("supprimer ce qu'une personne a créé, ni un quart déjà publié")}</li>
          </ul>
        </div>

        {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

        <div className="abo-actions">
          <button type="button" className="submit-btn" onClick={enregistrer} disabled={occupe || !modifie}>
            {occupe ? "..." : t("Enregistrer les permissions")}
          </button>
          {modifie && (
            <button type="button" className="admin-icon-btn" onClick={() => setPermissions(JSON.parse(enregistrees))} disabled={occupe}>
              {t("Annuler les changements")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
