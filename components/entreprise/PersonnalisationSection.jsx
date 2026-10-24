"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import InfoTooltip from "@/components/InfoTooltip";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";
import ImpressionCommandesBloc from "@/components/entreprise/ImpressionCommandesBloc";
import { mettreAJourTachesCommandes } from "@/lib/commandesClient";
import { IconFlecheBas } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";

const OPTIONS_PREMIER_JOUR = [
  { id: "lundi", label: "Lundi" },
  { id: "dimanche", label: "Dimanche" },
];

const OPTIONS_APPROBATION_DEMANDES = [
  { id: "manuelle", label: "Manuelle" },
  { id: "automatique", label: "Automatique" },
  { id: "desactive", label: "Désactivé" },
];

// Une fonctionnalité peut être désactivée (actif=false) ou activée avec
// approbation manuelle/automatique - un seul champ à 3 valeurs plutôt que
// deux booléens séparés à gérer dans l'interface.
function deriveApprobation(actif, auto) {
  if (actif === false) return "desactive";
  return auto ? "automatique" : "manuelle";
}

const OPTIONS_CALCUL_POINTAGE = [
  { id: "reel", label: "Heure réelle" },
  { id: "horaire", label: "Heure prévue" },
];

const OPTIONS_POINTAGE_MOBILE = [
  { id: "desactive", label: "Désactivé" },
  { id: "active", label: "Activé" },
];

const OPTIONS_RAPPELS_TEMPERATURE = [
  { id: "desactive", label: "Désactivés" },
  { id: "active", label: "Activés" },
];

const OPTIONS_RAPPELS_POINTAGE = [
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

const OPTIONS_SON_COMMANDES = [
  { id: "une_fois", label: "Une seule fois" },
  { id: "continu", label: "En continu jusqu'à ce que la commande soit prise" },
];

const OPTIONS_KIOSQUE_COMMANDES = [
  { id: "liste", label: "Liste (cartes des commandes du jour)" },
  { id: "sections", label: "3 sections (En attente, Traitées, Terminées)" },
];

const OPTIONS_IMPRESSION_MANUELLES = [
  { id: "desactivee", label: "Désactivée" },
  { id: "manuelle", label: "Manuelle (bouton Imprimer)" },
  { id: "automatique", label: "Automatique" },
];

const OPTIONS_PLANIF_COMMANDES = [
  { id: "active", label: "Activée" },
  { id: "desactive", label: "Désactivée" },
];

const OPTIONS_COMMANDES_VERS_TACHES = [
  { id: "active", label: "Activées" },
  { id: "desactive", label: "Désactivées" },
];

const OPTIONS_RETENTION_COMMANDES = [
  { id: "6", label: "6 mois" },
  { id: "12", label: "12 mois" },
  { id: "24", label: "24 mois" },
];

const OPTIONS_RETENTION_TEMPERATURE = [
  { id: "3", label: "3 mois" },
  { id: "6", label: "6 mois" },
  { id: "12", label: "12 mois" },
];

// Liste déroulante maison (voir .forfait-select-*) avec sa bulle d'aide "i".
// Gère son propre état ouvert/fermé et se ferme au clic à l'extérieur.
function ParametreSelect({ label, info, options, value, onChange, disabled }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useFermerAuClicExterieur(ref, open, () => setOpen(false));

  return (
    <div className="field param-field" ref={ref}>
      <label>
        {t(label)}
        {info && <InfoTooltip>{info}</InfoTooltip>}
      </label>
      <div className="forfait-select-wrap">
        <div className={`forfait-select-trigger${open ? " open" : ""}`} onClick={() => !disabled && setOpen((v) => !v)}>
          <div className="fs-label">{options.find((o) => o.id === value)?.label}</div>
          <span className="fs-arrow"><IconFlecheBas className="gozly-icon-inline" /></span>
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
                <div className="fo-label">{t(o.label)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PersonnalisationSection({ entrepriseId }) {
  const { t } = useT();
  const [modulesActifs, setModulesActifs] = useState([]);
  const [premierJourSemaine, setPremierJourSemaine] = useState("lundi");
  const [approbationEchanges, setApprobationEchanges] = useState("manuelle");
  const [approbationConges, setApprobationConges] = useState("manuelle");
  const [calculPointage, setCalculPointage] = useState("reel");
  const [pointageMobile, setPointageMobile] = useState("desactive");
  const [rappelsTemperature, setRappelsTemperature] = useState("desactive");
  const [rappelsPointage, setRappelsPointage] = useState("desactive");
  const [pushWix, setPushWix] = useState("manuel");
  const [visibiliteFeuilleTemps, setVisibiliteFeuilleTemps] = useState("manuelle");
  const [retentionDemandes, setRetentionDemandes] = useState("6");
  const [retentionTemperature, setRetentionTemperature] = useState("3");
  const [retentionCommandes, setRetentionCommandes] = useState("12");
  const [impressionManuelles, setImpressionManuelles] = useState("desactivee");
  const [kiosqueCommandes, setKiosqueCommandes] = useState("liste");
  const [sonCommandes, setSonCommandes] = useState("une_fois");
  const [commandesVersTaches, setCommandesVersTaches] = useState("active");
  const [planifDansCommandes, setPlanifDansCommandes] = useState("desactive");
  const [lieuWix, setLieuWix] = useState(""); // "" = toutes les succursales
  const [lieuxWixDispo, setLieuxWixDispo] = useState([]);
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
          "premier_jour_semaine, auto_approuver_echanges, echanges_actif, auto_approuver_conges, conges_actif, sync_produits_auto, pointage_calcul_mode, feuille_temps_visible_sans_approbation, demandes_retention_mois, pointage_mobile_actif, temperature_retention_mois, commandes_retention_mois, impression_commandes_manuelles, commandes_vers_taches, wix_lieu_nom, commandes_planning_integre"
        )
        .eq("id", entrepriseId)
        .maybeSingle(),
    ]);
    setModulesActifs((actifsData || []).map((m) => m.module));
    setPremierJourSemaine(entrepriseData?.premier_jour_semaine || "lundi");
    setApprobationEchanges(deriveApprobation(entrepriseData?.echanges_actif, entrepriseData?.auto_approuver_echanges));
    setApprobationConges(deriveApprobation(entrepriseData?.conges_actif, entrepriseData?.auto_approuver_conges));
    setPushWix(entrepriseData?.sync_produits_auto ? "automatique" : "manuel");
    setCalculPointage(entrepriseData?.pointage_calcul_mode || "reel");
    setPointageMobile(entrepriseData?.pointage_mobile_actif ? "active" : "desactive");
    setVisibiliteFeuilleTemps(entrepriseData?.feuille_temps_visible_sans_approbation ? "automatique" : "manuelle");
    setRetentionDemandes(String(entrepriseData?.demandes_retention_mois || 6));
    setRetentionTemperature(String(entrepriseData?.temperature_retention_mois || 3));
    setRetentionCommandes(String(entrepriseData?.commandes_retention_mois || 12));
    setImpressionManuelles(entrepriseData?.impression_commandes_manuelles || "desactivee");
    setCommandesVersTaches(entrepriseData?.commandes_vers_taches === false ? "desactive" : "active");
    setLieuWix(entrepriseData?.wix_lieu_nom || "");
    setPlanifDansCommandes(entrepriseData?.commandes_planning_integre ? "active" : "desactive");

    // Mode d'affichage du kiosque : lu à part (colonne de commandes_kiosque_mode.sql, absente tant que le SQL n'est pas exécuté).
    const { data: kiosqueData, error: kiosqueErreur } = await supabase.from("entreprises").select("commandes_kiosque_mode").eq("id", entrepriseId).maybeSingle();
    if (!kiosqueErreur) setKiosqueCommandes(kiosqueData?.commandes_kiosque_mode === "sections" ? "sections" : "liste");
    // Son des nouvelles commandes : colonne de commandes_son_mode.sql (absente tant que le SQL n'est pas exécuté : comportement selon l'affichage).
    const { data: sonData, error: sonErreur } = await supabase.from("entreprises").select("commandes_son_mode").eq("id", entrepriseId).maybeSingle();
    if (!sonErreur && sonData?.commandes_son_mode) setSonCommandes(sonData.commandes_son_mode === "continu" ? "continu" : "une_fois");
    else if (!kiosqueErreur) setSonCommandes(kiosqueData?.commandes_kiosque_mode === "sections" ? "continu" : "une_fois");

    // Rappels de températures : lus à part (colonne de temperature_rappels.sql, absente tant que le SQL n'est pas exécuté).
    const { data: rappelsData, error: rappelsErreur } = await supabase.from("entreprises").select("temperature_rappels_actif").eq("id", entrepriseId).maybeSingle();
    if (!rappelsErreur) setRappelsTemperature(rappelsData?.temperature_rappels_actif ? "active" : "desactive");

    // Rappel de pointage : lu à part (colonne de pointage_rappels.sql, absente tant que le SQL n'est pas exécuté).
    const { data: rappelsPointageData, error: rappelsPointageErreur } = await supabase.from("entreprises").select("pointage_rappels_actif").eq("id", entrepriseId).maybeSingle();
    if (!rappelsPointageErreur) setRappelsPointage(rappelsPointageData?.pointage_rappels_actif ? "active" : "desactive");

    // Les succursales Wix qu'on a vues passer dans les commandes de ce dashboard.
    const { data: lieuxData } = await supabase
      .from("commandes_en_ligne")
      .select("lieu_nom")
      .eq("entreprise_id", entrepriseId)
      .not("lieu_nom", "is", null)
      .limit(2000);
    setLieuxWixDispo([...new Set((lieuxData || []).map((l) => l.lieu_nom))].sort((a, b) => a.localeCompare(b, "fr")));
    setLoading(false);
  }

  async function handleChangePlanifDansCommandes(value) {
    setPlanifDansCommandes(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ commandes_planning_integre: value === "active" })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
  }

  async function handleChangeLieuWix(value) {
    setLieuWix(value);
    setSaving(true);
    setMsg(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch("/api/wix/lieu", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
        body: JSON.stringify({ entrepriseId, lieu: value || null }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(
        res.ok
          ? {
              type: "ok",
              text: value
                ? t("Succursale enregistrée") + (data.retirees ? " (" + t("{n} commande(s) d'une autre succursale retirée(s)", { n: data.retirees }) + ")" : "") + "."
                : t("Toutes les succursales : la prochaine synchro ramènera toutes les commandes."),
            }
          : { type: "err", text: data.error || t("L'enregistrement a échoué.") }
      );
    } catch {
      setMsg({ type: "err", text: t("L'enregistrement a échoué.") });
    }
    setSaving(false);
  }

  async function handleChangeCommandesVersTaches(value) {
    setCommandesVersTaches(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ commandes_vers_taches: value === "active" })
      .eq("id", entrepriseId);

    if (!error) await mettreAJourTachesCommandes(entrepriseId); // crée ou retire les tâches tout de suite
    setSaving(false);
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
  }

  async function handleChangeKiosqueCommandes(value) {
    setKiosqueCommandes(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("entreprises").update({ commandes_kiosque_mode: value }).eq("id", entrepriseId);

    setSaving(false);
    setMsg(
      error
        ? { type: "err", text: t("L'enregistrement a échoué. As-tu exécuté commandes_kiosque_mode.sql dans Supabase?") }
        : { type: "ok", text: t("Préférence enregistrée. Recharge le kiosque pour l'appliquer.") }
    );
  }

  async function handleChangeSonCommandes(value) {
    setSonCommandes(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("entreprises").update({ commandes_son_mode: value }).eq("id", entrepriseId);

    setSaving(false);
    setMsg(
      error
        ? { type: "err", text: t("L'enregistrement a échoué. As-tu exécuté commandes_son_mode.sql dans Supabase?") }
        : { type: "ok", text: t("Préférence enregistrée. Recharge le kiosque pour l'appliquer.") }
    );
  }

  async function handleChangeImpressionManuelles(value) {
    setImpressionManuelles(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ impression_commandes_manuelles: value })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
  }

  async function handleChangeRetentionCommandes(value) {
    setRetentionCommandes(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ commandes_retention_mois: Number(value) })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
  }

  async function handleChangeRetentionTemperature(value) {
    setRetentionTemperature(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ temperature_retention_mois: Number(value) })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
  }

  async function handleChangeRappelsTemperature(value) {
    setRappelsTemperature(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ temperature_rappels_actif: value === "active" })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(
      error
        ? { type: "err", text: t("L'enregistrement a échoué (le fichier SQL des rappels est-il exécuté ?).") }
        : { type: "ok", text: t("Préférence enregistrée.") }
    );
  }

  async function handleChangeRappelsPointage(value) {
    setRappelsPointage(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ pointage_rappels_actif: value === "active" })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(
      error
        ? { type: "err", text: t("L'enregistrement a échoué (le fichier SQL du rappel de pointage est-il exécuté ?).") }
        : { type: "ok", text: t("Préférence enregistrée.") }
    );
  }

  async function handleChangePremierJour(value) {
    setPremierJourSemaine(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("entreprises").update({ premier_jour_semaine: value }).eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
  }

  async function handleChangeApprobation(value) {
    setApprobationEchanges(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ echanges_actif: value !== "desactive", auto_approuver_echanges: value === "automatique" })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
  }

  async function handleChangeApprobationConges(value) {
    setApprobationConges(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase
      .from("entreprises")
      .update({ conges_actif: value !== "desactive", auto_approuver_conges: value === "automatique" })
      .eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
  }

  async function handleChangeCalculPointage(value) {
    setCalculPointage(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("entreprises").update({ pointage_calcul_mode: value }).eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
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
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
  }

  async function handleChangePushWix(value) {
    setPushWix(value);
    setSaving(true);
    setMsg(null);

    const { error } = await supabase.from("entreprises").update({ sync_produits_auto: value === "automatique" }).eq("id", entrepriseId);

    setSaving(false);
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
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
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
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
    setMsg(error ? { type: "err", text: t("L'enregistrement a échoué.") } : { type: "ok", text: t("Préférence enregistrée.") });
  }

  function toggleSection(id) {
    setSectionsOuvertes((cur) => ({ ...cur, [id]: !cur[id] }));
  }

  if (loading) {
    return <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>;
  }

  const horaireActif = modulesActifs.includes("horaire");
  const inventaireActif = modulesActifs.includes("inventaire");
  const temperatureActif = modulesActifs.includes("temperature");
  const commandesActif = modulesActifs.includes("commandes");

  return (
    <div>
      <h2>{t("Personnalisation")}</h2>
      <p className="panel-hint">{t("Ajuste le comportement de tes modules actifs.")}</p>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {!horaireActif && !inventaireActif && !temperatureActif && !commandesActif ? (
        <p className="section-hint">
          {t("Active un module (ex: Horaire & Pointage) pour voir apparaître ici ses options de personnalisation.")}
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
            <span className="ih-label">{t("Horaire & Pointage")}</span>
            <span className="ih-arrow"><IconFlecheBas className="gozly-icon-inline" /></span>
          </button>
          {sectionsOuvertes.horaire && (
            <div className="integration-body">
              <div className="param-subgroup">
                <div className="param-subgroup-label">{t("Horaire")}</div>
                <div className="param-grid">
                  <ParametreSelect
                    label={t("Premier jour de la semaine")}
                    info={t("Le jour où commence chaque semaine dans l'Horaire et la Feuille de temps.")}
                    options={OPTIONS_PREMIER_JOUR}
                    value={premierJourSemaine}
                    onChange={handleChangePremierJour}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="param-subgroup">
                <div className="param-subgroup-label">{t("Pointage")}</div>
                <div className="param-grid">
                  <ParametreSelect
                    label={t("Pointage mobile (GPS)")}
                    info={t("Permet de pointer depuis l'app mobile plutôt qu'au kiosque, en vérifiant la position GPS par rapport à l'adresse de la succursale (voir Emplacements). Le bouton n'apparaît que pour les employés assignés à une succursale avec une adresse valide, les jours où ils ont un quart prévu.")}
                    options={OPTIONS_POINTAGE_MOBILE}
                    value={pointageMobile}
                    onChange={handleChangePointageMobile}
                    disabled={saving}
                  />
                  <ParametreSelect
                    label={t("Rappel de pointage")}
                    info={t("Envoie une notification « N'oublie pas de pointer » à l'employé dont le quart publié a commencé depuis 10 minutes sans qu'il ait pointé. Les employés doivent avoir activé les notifications dans l'app.")}
                    options={OPTIONS_RAPPELS_POINTAGE}
                    value={rappelsPointage}
                    onChange={handleChangeRappelsPointage}
                    disabled={saving}
                  />
                  <ParametreSelect
                    label={t("Calcul des heures")}
                    info={t("Heure réelle : les heures comptent dès que l'employé pointe. Heure prévue : s'il pointe en avance, elles comptent à partir de l'heure de son quart. S'il pointe en retard ou sans quart prévu, l'heure réelle est toujours utilisée.")}
                    options={OPTIONS_CALCUL_POINTAGE}
                    value={calculPointage}
                    onChange={handleChangeCalculPointage}
                    disabled={saving}
                  />
                  <ParametreSelect
                    label={t("Visibilité de la feuille de temps")}
                    info={t("Les membres en lecture seule (ex: comptable) doivent-ils attendre ton approbation pour voir une semaine (manuelle), ou la voient-ils dès qu'elle existe (automatique) ?")}
                    options={OPTIONS_VISIBILITE_FEUILLE_TEMPS}
                    value={visibiliteFeuilleTemps}
                    onChange={handleChangeVisibiliteFeuilleTemps}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="param-subgroup">
                <div className="param-subgroup-label">{t("Demandes")}</div>
                <div className="param-grid">
                  <ParametreSelect
                    label={t("Approbation des congés")}
                    info={t("Quand un employé demande un congé : approuver toi-même (manuelle), valider tout de suite (automatique), ou désactiver complètement les demandes de congé.")}
                    options={OPTIONS_APPROBATION_DEMANDES}
                    value={approbationConges}
                    onChange={handleChangeApprobationConges}
                    disabled={saving}
                  />
                  <ParametreSelect
                    label={t("Approbation des échanges")}
                    info={t("Quand un employé accepte de prendre le quart d'un collègue : approuver l'échange toi-même (manuelle), le valider tout de suite (automatique), ou désactiver complètement les échanges.")}
                    options={OPTIONS_APPROBATION_DEMANDES}
                    value={approbationEchanges}
                    onChange={handleChangeApprobation}
                    disabled={saving}
                  />
                  <ParametreSelect
                    label={t("Conservation des demandes")}
                    info={t("Combien de temps garder une demande de congé ou d'échange une fois traitée avant sa suppression automatique. Une demande jamais traitée est supprimée après 2 semaines, peu importe ce réglage.")}
                    options={OPTIONS_RETENTION_DEMANDES}
                    value={retentionDemandes}
                    onChange={handleChangeRetentionDemandes}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {temperatureActif && (
        <div className="integration-item">
          <button
            type="button"
            className={`integration-header${sectionsOuvertes.temperature ? " open" : ""}`}
            onClick={() => toggleSection("temperature")}
          >
            <span className="ih-label">{t("Températures")}</span>
            <span className="ih-arrow"><IconFlecheBas className="gozly-icon-inline" /></span>
          </button>
          {sectionsOuvertes.temperature && (
            <div className="integration-body">
              <div className="param-grid">
                <ParametreSelect
                  label={t("Conservation des fiches")}
                  info={t("Combien de temps garder les fiches de température avant leur suppression automatique. Pense à les exporter (Températures → Historique → Exporter) pour les garder en local.")}
                  options={OPTIONS_RETENTION_TEMPERATURE}
                  value={retentionTemperature}
                  onChange={handleChangeRetentionTemperature}
                  disabled={saving}
                />
                <ParametreSelect
                  label={t("Rappels d'enregistrement")}
                  info={t("Envoie une notification « N'oubliez pas d'enregistrer les températures » aux employés au travail, 30 minutes avant la fin du créneau (11 h 30 pour le matin, 23 h 30 pour le soir), si aucun relevé n'a encore été enregistré pour ce créneau. Les employés doivent avoir activé les notifications dans l'app.")}
                  options={OPTIONS_RAPPELS_TEMPERATURE}
                  value={rappelsTemperature}
                  onChange={handleChangeRappelsTemperature}
                  disabled={saving}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {commandesActif && (
        <div className="integration-item">
          <button
            type="button"
            className={`integration-header${sectionsOuvertes.commandes ? " open" : ""}`}
            onClick={() => toggleSection("commandes")}
          >
            <span className="ih-label">{t("Commandes")}</span>
            <span className="ih-arrow"><IconFlecheBas className="gozly-icon-inline" /></span>
          </button>
          {sectionsOuvertes.commandes && (
            <div className="integration-body">
              <div className="param-subgroup">
                <div className="param-subgroup-label">{t("Général")}</div>
              <div className="param-grid">
                <ParametreSelect
                  label={t("Conservation des commandes")}
                  info={t("Combien de temps garder la copie des commandes reçues de Wix avant sa suppression automatique. Ton registre officiel reste dans ton tableau de bord Wix. Les commandes que tu entres à la main dans Gozly ne sont jamais supprimées automatiquement.")}
                  options={OPTIONS_RETENTION_COMMANDES}
                  value={retentionCommandes}
                  onChange={handleChangeRetentionCommandes}
                  disabled={saving}
                />
                <ParametreSelect
                  label={t("Succursale Wix de ce dashboard")}
                  info={t("Si le même site Wix alimente plusieurs dashboards Gozly (une succursale chacun), choisis ici la succursale dont CE dashboard reçoit les commandes et les ventes. Les commandes d'une autre succursale sont retirées de ce dashboard. « Toutes » = aucune séparation. La liste vient des commandes déjà reçues : synchronise d'abord, ou repasse sur « Toutes » pour revoir toutes les succursales.")}
                  options={[
                    { id: "", label: "Toutes les succursales" },
                    ...[...new Set([...lieuxWixDispo, ...(lieuWix ? [lieuWix] : [])])].map((nom) => ({ id: nom, label: nom })),
                  ]}
                  value={lieuWix}
                  onChange={handleChangeLieuWix}
                  disabled={saving}
                />
                <ParametreSelect
                  label={t("Planification dans les commandes")}
                  info={t("Ajoute une boîte « Planification » à droite de la page Commandes : les jours de la semaine (avec le nombre de réservations), et pour le jour choisi les catégories de tâches où tu peux ajouter ta production, sans quitter les réservations. Nécessite le module Tâches.")}
                  options={OPTIONS_PLANIF_COMMANDES}
                  value={planifDansCommandes}
                  onChange={handleChangePlanifDansCommandes}
                  disabled={saving}
                />
                <ParametreSelect
                  label={t("Affichage du kiosque des commandes")}
                  info={t("Liste : une seule liste de cartes avec les commandes du jour (les précommandes sont dans « Commandes à venir »). 3 sections : toutes les commandes arrivent dans « En attente », puis passent à « Traitées » et « Terminées », peu importe leur date ; l'écran ne se vide pas à minuit, seules les terminées sont nettoyées (bouton Vider, et celles d'avant hier disparaissent seules). Recharge le kiosque après un changement.")}
                  options={OPTIONS_KIOSQUE_COMMANDES}
                  value={kiosqueCommandes}
                  onChange={handleChangeKiosqueCommandes}
                  disabled={saving}
                />
                <ParametreSelect
                  label={t("Son des nouvelles commandes en ligne")}
                  info={t("Une seule fois : le son joue une fois quand une commande en ligne arrive. En continu : il se répète toutes les quelques secondes jusqu'à ce que la commande soit prise en charge (3 sections : quand tu la passes de « En attente » à « Traitées » ; liste : quand tu touches la commande ou le bouton « Arrêter le son »). Vaut pour les deux affichages. Le son doit être activé sur le kiosque (bouton « Activer le son »). Recharge le kiosque après un changement.")}
                  options={OPTIONS_SON_COMMANDES}
                  value={sonCommandes}
                  onChange={handleChangeSonCommandes}
                  disabled={saving}
                />
                <ParametreSelect
                  label={t("Tâches automatiques des commandes")}
                  info={t("Crée automatiquement, dans le module Tâches, une tâche par produit avec le total à préparer pour chaque jour de ramassage (ex: « Pizza au tomate × 6 »), dans la catégorie « Réservations ». Cocher la tâche veut dire que c'est préparé. Nécessite le module Tâches.")}
                  options={OPTIONS_COMMANDES_VERS_TACHES}
                  value={commandesVersTaches}
                  onChange={handleChangeCommandesVersTaches}
                  disabled={saving}
                />
              </div>
              </div>
              <ImpressionCommandesBloc
                entrepriseId={entrepriseId}
                selecteur={
                      <ParametreSelect
                        label={t("Impression des commandes manuelles")}
                        info={t("Pour les commandes que tu entres à la main dans Gozly (nécessite l'impression activée avec le bouton à côté). Désactivée : jamais imprimées. Manuelle : tu imprimes avec le bouton Imprimer. Automatique : le bon sort dès que la commande est créée. Les commandes Wix s'impriment quand elles passent à « Traitée ».")}
                        options={OPTIONS_IMPRESSION_MANUELLES}
                        value={impressionManuelles}
                        onChange={handleChangeImpressionManuelles}
                        disabled={saving}
                      />
                }
              />
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
            <span className="ih-label">{t("Inventaire")}</span>
            <span className="ih-arrow"><IconFlecheBas className="gozly-icon-inline" /></span>
          </button>
          {sectionsOuvertes.inventaire && (
            <div className="integration-body">
              <div className="param-grid">
                <ParametreSelect
                  label={t("Synchronisation vers Wix")}
                  info={t("Une fois Wix connecté (Entreprise → Intégrations) : pousser tes produits vers Wix automatiquement à chaque ajout/modification/suppression, ou seulement quand tu cliques « Synchroniser ».")}
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
