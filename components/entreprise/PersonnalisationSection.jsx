"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const OPTIONS_PREMIER_JOUR = [
  { id: "lundi", label: "Lundi" },
  { id: "dimanche", label: "Dimanche" },
];

const OPTIONS_APPROBATION_ECHANGES = [
  { id: "manuelle", label: "Manuelle (tu dois approuver)" },
  { id: "automatique", label: "Automatique" },
];

const OPTIONS_PUSH_WIX = [
  { id: "manuel", label: "Manuel (bouton Synchroniser)" },
  { id: "automatique", label: "Automatique à chaque changement" },
];

export default function PersonnalisationSection({ entrepriseId }) {
  const [modulesActifs, setModulesActifs] = useState([]);
  const [premierJourSemaine, setPremierJourSemaine] = useState("lundi");
  const [premierJourOpen, setPremierJourOpen] = useState(false);
  const [approbationEchanges, setApprobationEchanges] = useState("manuelle");
  const [approbationOpen, setApprobationOpen] = useState(false);
  const [pushWix, setPushWix] = useState("manuel");
  const [pushWixOpen, setPushWixOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    load();
  }, [entrepriseId]);

  async function load() {
    setLoading(true);
    const [{ data: actifsData }, { data: entrepriseData }] = await Promise.all([
      supabase.from("modules_actifs").select("module").eq("entreprise_id", entrepriseId),
      supabase
        .from("entreprises")
        .select("premier_jour_semaine, auto_approuver_echanges, wix_push_auto")
        .eq("id", entrepriseId)
        .maybeSingle(),
    ]);
    setModulesActifs((actifsData || []).map((m) => m.module));
    setPremierJourSemaine(entrepriseData?.premier_jour_semaine || "lundi");
    setApprobationEchanges(entrepriseData?.auto_approuver_echanges ? "automatique" : "manuelle");
    setPushWix(entrepriseData?.wix_push_auto ? "automatique" : "manuel");
    setLoading(false);
  }

  async function handleChangePremierJour(value) {
    setPremierJourOpen(false);
    setPremierJourSemaine(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("entreprises").update({ premier_jour_semaine: value }).eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: "L'enregistrement a échoué." } : { type: "ok", text: "Préférence enregistrée." });
  }

  async function handleChangeApprobation(value) {
    setApprobationOpen(false);
    setApprobationEchanges(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ auto_approuver_echanges: value === "automatique" })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: "L'enregistrement a échoué." } : { type: "ok", text: "Préférence enregistrée." });
  }

  async function handleChangePushWix(value) {
    setPushWixOpen(false);
    setPushWix(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("entreprises").update({ wix_push_auto: value === "automatique" }).eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: "L'enregistrement a échoué." } : { type: "ok", text: "Préférence enregistrée." });
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>Chargement...</p>;
  }

  const horaireActif = modulesActifs.includes("horaire");
  const inventaireActif = modulesActifs.includes("inventaire");

  return (
    <div>
      <h2>Personnalisation</h2>
      <p className="panel-hint">Ajuste le comportement de tes modules actifs.</p>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {!horaireActif && !inventaireActif ? (
        <p className="section-hint">
          Active un module (ex: Horaire &amp; Pointage) pour voir apparaître ici ses options de personnalisation.
        </p>
      ) : (
        <>
      {horaireActif && (
        <div className="settings-section">
          <h3>Horaire &amp; Pointage</h3>
          <p className="section-hint">Le jour où commence chaque semaine dans l'Horaire et la Feuille de temps.</p>
          <div className="field" style={{ maxWidth: "220px" }}>
            <label>Premier jour de la semaine</label>
            <div className="forfait-select-wrap">
              <div
                className={`forfait-select-trigger${premierJourOpen ? " open" : ""}`}
                onClick={() => !saving && setPremierJourOpen((v) => !v)}
              >
                <div className="fs-label">
                  {OPTIONS_PREMIER_JOUR.find((o) => o.id === premierJourSemaine)?.label}
                </div>
                <span className="fs-arrow">▾</span>
              </div>
              {premierJourOpen && (
                <div className="forfait-select-options open">
                  {OPTIONS_PREMIER_JOUR.map((o) => (
                    <div key={o.id} className="forfait-option" onClick={() => handleChangePremierJour(o.id)}>
                      <div className="fo-label">{o.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="section-hint" style={{ marginTop: "18px" }}>
            Quand un employé accepte de prendre le quart d'un collègue, faut-il approuver l'échange toi-même ?
          </p>
          <div className="field" style={{ maxWidth: "260px" }}>
            <label>Approbation des échanges de quart</label>
            <div className="forfait-select-wrap">
              <div
                className={`forfait-select-trigger${approbationOpen ? " open" : ""}`}
                onClick={() => !saving && setApprobationOpen((v) => !v)}
              >
                <div className="fs-label">
                  {OPTIONS_APPROBATION_ECHANGES.find((o) => o.id === approbationEchanges)?.label}
                </div>
                <span className="fs-arrow">▾</span>
              </div>
              {approbationOpen && (
                <div className="forfait-select-options open">
                  {OPTIONS_APPROBATION_ECHANGES.map((o) => (
                    <div key={o.id} className="forfait-option" onClick={() => handleChangeApprobation(o.id)}>
                      <div className="fo-label">{o.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {inventaireActif && (
        <div className="settings-section">
          <h3>Inventaire</h3>
          <p className="section-hint">
            Une fois Wix connecté (Entreprise → Intégrations), faut-il pousser tes produits Gozly vers Wix
            automatiquement à chaque ajout/modification/suppression, ou seulement quand tu cliques
            "Synchroniser" ?
          </p>
          <div className="field" style={{ maxWidth: "300px" }}>
            <label>Synchronisation vers Wix</label>
            <div className="forfait-select-wrap">
              <div
                className={`forfait-select-trigger${pushWixOpen ? " open" : ""}`}
                onClick={() => !saving && setPushWixOpen((v) => !v)}
              >
                <div className="fs-label">{OPTIONS_PUSH_WIX.find((o) => o.id === pushWix)?.label}</div>
                <span className="fs-arrow">▾</span>
              </div>
              {pushWixOpen && (
                <div className="forfait-select-options open">
                  {OPTIONS_PUSH_WIX.map((o) => (
                    <div key={o.id} className="forfait-option" onClick={() => handleChangePushWix(o.id)}>
                      <div className="fo-label">{o.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
