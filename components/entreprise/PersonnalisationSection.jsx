"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import InfoTooltip from "@/components/InfoTooltip";

const OPTIONS_PREMIER_JOUR = [
  { id: "lundi", label: "Lundi" },
  { id: "dimanche", label: "Dimanche" },
];

const OPTIONS_APPROBATION_ECHANGES = [
  { id: "manuelle", label: "Manuelle" },
  { id: "automatique", label: "Automatique" },
];

const OPTIONS_CALCUL_POINTAGE = [
  { id: "reel", label: "Heure réelle" },
  { id: "horaire", label: "Heure prévue" },
];

const OPTIONS_POINTAGE_MOBILE = [
  { id: "desactive", label: "Désactivé" },
  { id: "active", label: "Activé" },
];

const OPTIONS_PUSH_WIX = [
  { id: "manuel", label: "Manuel" },
  { id: "automatique", label: "Automatique" },
];

const OPTIONS_VISIBILITE_FEUILLE_TEMPS = [
  { id: "manuelle", label: "Manuelle" },
  { id: "automatique", label: "Automatique" },
];

const OPTIONS_RETENTION_DEMANDES = [
  { id: "3", label: "3 mois" },
  { id: "6", label: "6 mois" },
  { id: "12", label: "12 mois" },
];

// Liste déroulante maison (voir .forfait-select-*) avec sa bulle d'aide "i".
// Gère son propre état ouvert/fermé et se ferme au clic à l'extérieur.
function ParametreSelect({ label, info, options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function fermerSiDehors(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", fermerSiDehors);
    return () => document.removeEventListener("mousedown", fermerSiDehors);
  }, [open]);

  return (
    <div className="field param-field" ref={ref}>
      <label>
        {label}
        {info && <InfoTooltip>{info}</InfoTooltip>}
      </label>
      <div className="forfait-select-wrap">
        <div className={`forfait-select-trigger${open ? " open" : ""}`} onClick={() => !disabled && setOpen((v) => !v)}>
          <div className="fs-label">{options.find((o) => o.id === value)?.label}</div>
          <span className="fs-arrow">▾</span>
        </div>
        {open && (
          <div className="forfait-select-options open">
            {options.map((o) => (
              <div
                key={o.id}
                className="forfait-option"
                onClick={() => {
                  setOpen(false);
                  onChange(o.id);
                }}
              >
                <div className="fo-label">{o.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PersonnalisationSection({ entrepriseId }) {
  const [modulesActifs, setModulesActifs] = useState([]);
  const [premierJourSemaine, setPremierJourSemaine] = useState("lundi");
  const [approbationEchanges, setApprobationEchanges] = useState("manuelle");
  const [calculPointage, setCalculPointage] = useState("reel");
  const [pointageMobile, setPointageMobile] = useState("desactive");
  const [pushWix, setPushWix] = useState("manuel");
  const [visibiliteFeuilleTemps, setVisibiliteFeuilleTemps] = useState("manuelle");
  const [retentionDemandes, setRetentionDemandes] = useState("6");
  const [sectionsOuvertes, setSectionsOuvertes] = useState({});
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
        .select(
          "premier_jour_semaine, auto_approuver_echanges, sync_produits_auto, pointage_calcul_mode, feuille_temps_visible_sans_approbation, demandes_retention_mois, pointage_mobile_actif"
        )
        .eq("id", entrepriseId)
        .maybeSingle(),
    ]);
    setModulesActifs((actifsData || []).map((m) => m.module));
    setPremierJourSemaine(entrepriseData?.premier_jour_semaine || "lundi");
    setApprobationEchanges(entrepriseData?.auto_approuver_echanges ? "automatique" : "manuelle");
    setPushWix(entrepriseData?.sync_produits_auto ? "automatique" : "manuel");
    setCalculPointage(entrepriseData?.pointage_calcul_mode || "reel");
    setPointageMobile(entrepriseData?.pointage_mobile_actif ? "active" : "desactive");
    setVisibiliteFeuilleTemps(entrepriseData?.feuille_temps_visible_sans_approbation ? "automatique" : "manuelle");
    setRetentionDemandes(String(entrepriseData?.demandes_retention_mois || 6));
    setLoading(false);
  }

  async function handleChangePremierJour(value) {
    setPremierJourSemaine(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("entreprises").update({ premier_jour_semaine: value }).eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: "L'enregistrement a échoué." } : { type: "ok", text: "Préférence enregistrée." });
  }

  async function handleChangeApprobation(value) {
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

  async function handleChangeCalculPointage(value) {
    setCalculPointage(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("entreprises").update({ pointage_calcul_mode: value }).eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: "L'enregistrement a échoué." } : { type: "ok", text: "Préférence enregistrée." });
  }

  async function handleChangePointageMobile(value) {
    setPointageMobile(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ pointage_mobile_actif: value === "active" })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: "L'enregistrement a échoué." } : { type: "ok", text: "Préférence enregistrée." });
  }

  async function handleChangePushWix(value) {
    setPushWix(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("entreprises").update({ sync_produits_auto: value === "automatique" }).eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: "L'enregistrement a échoué." } : { type: "ok", text: "Préférence enregistrée." });
  }

  async function handleChangeVisibiliteFeuilleTemps(value) {
    setVisibiliteFeuilleTemps(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ feuille_temps_visible_sans_approbation: value === "automatique" })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: "L'enregistrement a échoué." } : { type: "ok", text: "Préférence enregistrée." });
  }

  async function handleChangeRetentionDemandes(value) {
    setRetentionDemandes(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ demandes_retention_mois: Number(value) })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: "L'enregistrement a échoué." } : { type: "ok", text: "Préférence enregistrée." });
  }

  function toggleSection(id) {
    setSectionsOuvertes((cur) => ({ ...cur, [id]: !cur[id] }));
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
        <div className="integration-list">
      {horaireActif && (
        <div className="integration-item">
          <button
            type="button"
            className={`integration-header${sectionsOuvertes.horaire ? " open" : ""}`}
            onClick={() => toggleSection("horaire")}
          >
            <span className="ih-label">Horaire &amp; Pointage</span>
            <span className="ih-arrow">▾</span>
          </button>
          {sectionsOuvertes.horaire && (
            <div className="integration-body">
              <div className="param-grid">
                <ParametreSelect
                  label="Premier jour de la semaine"
                  info="Le jour où commence chaque semaine dans l'Horaire et la Feuille de temps."
                  options={OPTIONS_PREMIER_JOUR}
                  value={premierJourSemaine}
                  onChange={handleChangePremierJour}
                  disabled={saving}
                />
                <ParametreSelect
                  label="Pointage mobile (GPS)"
                  info="Permet de pointer depuis l'app mobile plutôt qu'au kiosque, en vérifiant la position GPS par rapport à l'adresse de la succursale (voir Emplacements). Le bouton n'apparaît que pour les employés assignés à une succursale avec une adresse valide, les jours où ils ont un quart prévu."
                  options={OPTIONS_POINTAGE_MOBILE}
                  value={pointageMobile}
                  onChange={handleChangePointageMobile}
                  disabled={saving}
                />
                <ParametreSelect
                  label="Approbation des échanges"
                  info="Quand un employé accepte de prendre le quart d'un collègue : approuver l'échange toi-même (manuelle) ou le valider tout de suite (automatique)."
                  options={OPTIONS_APPROBATION_ECHANGES}
                  value={approbationEchanges}
                  onChange={handleChangeApprobation}
                  disabled={saving}
                />
                <ParametreSelect
                  label="Calcul des heures"
                  info="Heure réelle : les heures comptent dès que l'employé pointe. Heure prévue : s'il pointe en avance, elles comptent à partir de l'heure de son quart. S'il pointe en retard ou sans quart prévu, l'heure réelle est toujours utilisée."
                  options={OPTIONS_CALCUL_POINTAGE}
                  value={calculPointage}
                  onChange={handleChangeCalculPointage}
                  disabled={saving}
                />
                <ParametreSelect
                  label="Visibilité de la feuille de temps"
                  info="Les membres en lecture seule (ex: comptable) doivent-ils attendre ton approbation pour voir une semaine (manuelle), ou la voient-ils dès qu'elle existe (automatique) ?"
                  options={OPTIONS_VISIBILITE_FEUILLE_TEMPS}
                  value={visibiliteFeuilleTemps}
                  onChange={handleChangeVisibiliteFeuilleTemps}
                  disabled={saving}
                />
                <ParametreSelect
                  label="Conservation des demandes"
                  info="Combien de temps garder une demande de congé ou d'échange une fois traitée avant sa suppression automatique. Une demande jamais traitée est supprimée après 2 semaines, peu importe ce réglage."
                  options={OPTIONS_RETENTION_DEMANDES}
                  value={retentionDemandes}
                  onChange={handleChangeRetentionDemandes}
                  disabled={saving}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {inventaireActif && (
        <div className="integration-item">
          <button
            type="button"
            className={`integration-header${sectionsOuvertes.inventaire ? " open" : ""}`}
            onClick={() => toggleSection("inventaire")}
          >
            <span className="ih-label">Inventaire</span>
            <span className="ih-arrow">▾</span>
          </button>
          {sectionsOuvertes.inventaire && (
            <div className="integration-body">
              <div className="param-grid">
                <ParametreSelect
                  label="Synchronisation vers Wix"
                  info="Une fois Wix connecté (Entreprise → Intégrations) : pousser tes produits vers Wix automatiquement à chaque ajout/modification/suppression, ou seulement quand tu cliques « Synchroniser »."
                  options={OPTIONS_PUSH_WIX}
                  value={pushWix}
                  onChange={handleChangePushWix}
                  disabled={saving}
                />
              </div>
            </div>
          )}
        </div>
      )}
        </div>
      )}
    </div>
  );
}
