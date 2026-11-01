"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EmplacementSelect from "@/components/EmplacementSelect";
import { getEmplacementSelectionne, setEmplacementSelectionne } from "@/lib/entreprise";
import { useGestion } from "@/components/gestion/GestionShell";
import { chargerEquipements } from "@/lib/equipementsTemperature";
import { estConforme, creneauActuel } from "@/lib/temperature";
import TemperatureInput from "@/components/TemperatureInput";
import { dateAujourdhui, decalerJour } from "@/lib/commandes";
import { telechargerPdfTemperatures } from "@/lib/exportPdf";
import { IconAttention, IconCrochet, IconPoint, IconFlecheDroite, IconFlecheGauche, IconTelecharger } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";

const ROUGE = "#ff9494";

// Températures pour le téléphone du gestionnaire, comme dans l'app employé : une grille équipement / AM / PM où
// l'on saisit les relevés du créneau en cours (aujourd'hui). On peut aussi changer de jour avec ‹ › pour revoir
// les relevés passés (non conformes en rouge), et télécharger le rapport PDF de la journée.
export default function TemperatureGestion() {
  const { t: tr } = useT();
  const { entrepriseId, user } = useGestion();
  const creneau = creneauActuel();
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const relevesRef = useRef([]);
  const dateRef = useRef(null);
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
    const nouveaux = data || [];
    // Relevés des collègues rafraîchis sans écraser ce qui est en train d'être saisi (sauf si on vient de changer de jour).
    const memeJour = dateRef.current === date;
    const seed = {};
    for (const r of nouveaux) if (r.periode === creneau.periode) seed[r.equipement_id] = String(r.temperature);
    setDrafts((prev) => {
      if (!memeJour) return seed;
      const suivant = { ...seed };
      for (const k of Object.keys(prev)) {
        const vieux = relevesRef.current.find((r) => r.equipement_id === k && r.periode === creneau.periode);
        if (prev[k] !== (vieux ? String(vieux.temperature) : "")) suivant[k] = prev[k];
      }
      return suivant;
    });
    dateRef.current = date;
    relevesRef.current = nouveaux;
    setReleves(nouveaux);
    setLoading(false);
  }, [entrepriseId, date, creneau.periode]);

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

  const saisieOuverte = date === creneau.date; // on ne saisit que le créneau en cours, aujourd'hui
  const existant = (equipementId, periode) => releves.find((r) => r.equipement_id === equipementId && r.periode === periode);
  const estModifie = () =>
    saisieOuverte &&
    visibles.some((e) => {
      const r = existant(e.id, creneau.periode);
      return (drafts[e.id] ?? "") !== (r ? String(r.temperature) : "");
    });

  async function enregistrer() {
    setSaving(true);
    setMsg(null);
    const aEnvoyer = visibles.filter((e) => {
      const r = existant(e.id, creneau.periode);
      const v = drafts[e.id] ?? "";
      return v !== "" && v !== (r ? String(r.temperature) : "");
    });
    const rows = aEnvoyer.map((e) => ({
      entreprise_id: entrepriseId,
      equipement_id: e.id,
      releve_par: user?.user_metadata?.full_name || user?.email,
      temperature: parseFloat(drafts[e.id]),
      conforme: estConforme(e.type, parseFloat(drafts[e.id]), e.unite),
      date_relevee: creneau.date,
      periode: creneau.periode,
    }));
    const { error } = await supabase.from("releves_temperature").upsert(rows, { onConflict: "equipement_id,date_relevee,periode" });
    setSaving(false);
    if (error) {
      setMsg({ type: "err", text: tr("L'enregistrement a échoué.") });
      return;
    }
    setMsg({ type: "ok", text: tr("Relevés enregistrés !") });
    setTimeout(() => setMsg(null), 3000);
    chargerReleves();
  }

  // Sur téléphone la place est comptée : colonnes AM/PM étroites, nom qui peut passer à la ligne.
  const grille = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 90px 90px", gap: "6px", alignItems: "center", padding: "8px 0" };

  // Une case AM ou PM : champ de saisie pour le créneau actuel (aujourd'hui), sinon le relevé en lecture seule (ou un tiret).
  function renderCase(e, periode) {
    if (saisieOuverte && periode === creneau.periode) {
      return (
        <TemperatureInput placeholder={`°${e.unite === "F" ? "F" : "C"}`} value={drafts[e.id] ?? ""} onChange={(v) => setDrafts((prev) => ({ ...prev, [e.id]: v }))} />
      );
    }
    const r = existant(e.id, periode);
    return (
      <div style={{ textAlign: "center", fontSize: "13px", color: r ? (r.conforme ? "var(--text)" : ROUGE) : "var(--text-dim)", fontWeight: r && !r.conforme ? 700 : undefined }}>
        {r ? <>{r.conforme ? <IconCrochet className="gozly-icon" /> : <IconAttention className="gozly-icon" />} {String(r.temperature).replace(".", ",")}°{e.unite === "F" ? "F" : "C"}</> : "—"}
      </div>
    );
  }

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

          <div className="planning-day" style={{ margin: "12px 0 14px", padding: "12px 10px" }}>
            <div style={{ ...grille, paddingBottom: "6px", fontSize: "12px", fontWeight: 700, color: "var(--text-dim)" }}>
              <div>{tr("Équipement")}</div>
              {["am", "pm"].map((p) => (
                <div key={p} style={{ textAlign: "center", color: saisieOuverte && p === creneau.periode ? "var(--text)" : undefined }}>
                  {p.toUpperCase()}
                  {saisieOuverte && p === creneau.periode ? <> <IconPoint className="gozly-icon-inline" /></> : ""}
                </div>
              ))}
            </div>
            {visibles.map((e) => {
              const actuel = existant(e.id, saisieOuverte ? creneau.periode : "am") || existant(e.id, "pm");
              return (
                <div key={e.id} style={grille}>
                  <div style={{ fontSize: "13.5px", fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>
                    {e.nom}
                    {actuel?.releve_par && <div style={{ fontSize: "11px", fontWeight: 400, color: "var(--text-dim)" }}>{tr("par")} {actuel.releve_par}</div>}
                  </div>
                  {renderCase(e, "am")}
                  {renderCase(e, "pm")}
                </div>
              );
            })}
          </div>

          {saisieOuverte && (
            <div className="submit-wrap" style={{ marginTop: "16px", position: "static" }}>
              <button type="button" className="submit-btn" onClick={enregistrer} disabled={saving || !estModifie()}>
                {saving ? tr("Enregistrement...") : tr("Enregistrer")}
              </button>
            </div>
          )}
          {msg && <p className={`settings-msg ${msg.type}`} style={{ textAlign: "center" }}>{msg.text}</p>}
        </>
      )}
    </div>
  );
}
