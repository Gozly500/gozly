"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EmplacementSelect from "@/components/EmplacementSelect";
import { getEmplacementSelectionne, setEmplacementSelectionne } from "@/lib/entreprise";
import { useGestion } from "@/components/gestion/GestionShell";
import { chargerEquipements } from "@/lib/equipementsTemperature";
import { TYPES_EQUIPEMENT } from "@/lib/temperature";
import { dateAujourdhui, decalerJour } from "@/lib/commandes";
import { telechargerPdfTemperatures } from "@/lib/exportPdf";
import { IconAttention, IconFlecheDroite, IconFlecheGauche, IconTelecharger } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";

const ROUGE = "#ff9494";

// Températures pour le téléphone du gestionnaire : on change de jour avec ‹ ›, on voit pour chaque équipement le
// relevé du matin et du soir (en rouge s'il n'est pas conforme, « manquant » s'il n'a pas été pris), et on
// télécharge le rapport PDF de la journée.
export default function TemperatureGestion() {
  const { t: tr } = useT();
  const { entrepriseId } = useGestion();
  const [date, setDate] = useState(dateAujourdhui);
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementId] = useState(null);
  const [equipements, setEquipements] = useState([]);
  const [releves, setReleves] = useState([]);
  const [pret, setPret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportEnCours, setExportEnCours] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: emps }, eqs] = await Promise.all([
        supabase.from("emplacements").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
        chargerEquipements(supabase, entrepriseId),
      ]);
      const liste = emps || [];
      setEmplacements(liste);
      setEquipements(eqs || []);
      if (liste.length > 1) {
        const sauve = getEmplacementSelectionne(entrepriseId);
        setEmplacementId(sauve && liste.some((e) => e.id === sauve) ? sauve : liste[0].id);
      }
      setPret(true);
    })();
  }, [entrepriseId]);

  const chargerReleves = useCallback(async () => {
    const { data } = await supabase.from("releves_temperature").select("*").eq("entreprise_id", entrepriseId).eq("date_relevee", date);
    setReleves(data || []);
    setLoading(false);
  }, [entrepriseId, date]);

  useEffect(() => {
    if (!pret) return;
    setLoading(true);
    chargerReleves();
  }, [pret, chargerReleves]);

  // Les employés prennent leurs relevés : on relit toutes les 30 s tant que l'écran est visible.
  useEffect(() => {
    if (!pret) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") chargerReleves();
    }, 30000);
    return () => clearInterval(id);
  }, [pret, chargerReleves]);

  const aujourdhui = dateAujourdhui();
  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" });
  const visibles = emplacementId ? equipements.filter((e) => e.emplacement_id === emplacementId) : equipements;
  const relevesVisibles = releves.filter((r) => visibles.some((e) => e.id === r.equipement_id));
  const nonConformes = relevesVisibles.filter((r) => !r.conforme).length;
  const manquants = visibles.reduce((n, e) => n + ["am", "pm"].filter((p) => !releves.some((r) => r.equipement_id === e.id && r.periode === p)).length, 0);
  // Pour la journée en cours, le relevé du soir n'est pas « manquant » avant la fin de la journée : on ne compte que le matin.
  const manquantsAffiches = date === aujourdhui ? visibles.filter((e) => !releves.some((r) => r.equipement_id === e.id && r.periode === "am")).length : manquants;

  async function exporterPdf() {
    setExportEnCours(true);
    try {
      const { data: ent } = await supabase.from("entreprises").select("nom").eq("id", entrepriseId).maybeSingle();
      await telechargerPdfTemperatures({
        entrepriseNom: ent?.nom || "",
        succursaleNom: emplacements.find((e) => e.id === emplacementId)?.nom || "",
        releves: relevesVisibles,
        equipements,
        emplacements,
        nomFichier: `registre-temperatures-${date}.pdf`,
      });
    } finally {
      setExportEnCours(false);
    }
  }

  const cellule = (equipement, periode, libelle) => {
    const r = releves.find((x) => x.equipement_id === equipement.id && x.periode === periode);
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12px", color: "var(--text-dim)" }}>{libelle}</div>
        {r ? (
          <div style={{ fontWeight: 700, fontSize: "18px", color: r.conforme ? undefined : ROUGE }}>
            {String(r.temperature).replace(".", ",")} °{equipement.unite === "F" ? "F" : "C"}
            {!r.conforme && <> <IconAttention className="gozly-icon" /></>}
            {r.releve_par && <div style={{ fontWeight: 400, fontSize: "12px", color: "var(--text-dim)" }}>{r.releve_par}</div>}
          </div>
        ) : (
          <div style={{ color: "var(--text-dim)", fontSize: "15px" }}>{tr("Pas de relevé")}</div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2 style={{ marginBottom: "10px" }}>{tr("Températures")}</h2>

      <div className="moi-week-nav">
        <button className="admin-icon-btn" onClick={() => setDate((d) => decalerJour(d, -1))}>
          <IconFlecheGauche className="gozly-icon" />
        </button>
        <span className="moi-week-label" style={{ textTransform: "capitalize" }}>
          {dateLabel}
        </span>
        <button className="admin-icon-btn" onClick={() => setDate((d) => decalerJour(d, 1))} disabled={date >= aujourdhui}>
          <IconFlecheDroite className="gozly-icon" />
        </button>
      </div>
      {date !== aujourdhui && (
        <div style={{ textAlign: "center", marginTop: "-8px", marginBottom: "12px" }}>
          <button className="admin-icon-btn" onClick={() => setDate(aujourdhui)}>
            {tr("Aujourd'hui")}
          </button>
        </div>
      )}

      <EmplacementSelect
        emplacements={emplacements}
        value={emplacementId}
        onChange={(id) => {
          setEmplacementId(id);
          setEmplacementSelectionne(entrepriseId, id);
        }}
      />

      {!pret || loading ? (
        <p style={{ color: "var(--text-dim)" }}>{tr("Chargement...")}</p>
      ) : visibles.length === 0 ? (
        <p className="chat-empty">{tr("Aucun équipement. Ajoutes-en sur l'ordinateur (Températures).")}</p>
      ) : (
        <>
          <div className="gestion-resume">
            <span>
              {nonConformes > 0 ? (
                <strong style={{ color: ROUGE }}>
                  {nonConformes} {tr(nonConformes > 1 ? "non conformes" : "non conforme")}
                </strong>
              ) : (
                <strong>{tr("Tout est conforme")}</strong>
              )}
              {manquantsAffiches > 0 && <> · {manquantsAffiches} {tr(manquantsAffiches > 1 ? "relevés manquants" : "relevé manquant")}</>}
            </span>
            <button type="button" className="admin-icon-btn" onClick={exporterPdf} disabled={exportEnCours || relevesVisibles.length === 0}>
              {exportEnCours ? tr("PDF...") : <><IconTelecharger className="gozly-icon" />{" "}{tr("PDF")}</>}
            </button>
          </div>

          <div className="gestion-cartes" style={{ marginTop: "12px" }}>
            {visibles.map((e) => (
              <div className="planning-day gestion-tache-categorie" key={e.id}>
                <div className="gestion-tache-tete">
                  <span className="planning-day-title">{e.nom}</span>
                  <span style={{ fontSize: "12.5px", color: "var(--text-dim)" }}>{tr(TYPES_EQUIPEMENT.find((x) => x.id === e.type)?.label || "")}</span>
                </div>
                <div style={{ display: "flex", gap: "16px", padding: "4px 2px 2px" }}>
                  {cellule(e, "am", tr("Matin"))}
                  {cellule(e, "pm", tr("Soir"))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
