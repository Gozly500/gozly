"use client";

import { useEffect, useRef, useState } from "react";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";
import { supabase } from "@/lib/supabaseClient";
import { SOURCES_VENTE } from "@/lib/modules";
import { getDebutSemaine, addDays } from "@/lib/semaine";
import { IconIntegration } from "@/components/icons/GozlyIcons";
import { IconFlecheBas, IconFlecheDroite, IconFlecheGauche, IconTelecharger } from "@/components/icons/Pictogrammes";
import CalendrierJour from "@/components/ventes/CalendrierJour";
import VentesJour from "@/components/ventes/VentesJour";
import { telechargerFichier } from "@/lib/temperature";
import { ecartMoneris, journeesEnCsv, pdfJournees, totalJour } from "@/lib/ventesExport";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";
import { dateAujourdhui, decalerJour } from "@/lib/commandes";

const FORM_VIDE = { source: "comptant", montant: "", date: "", description: "" };

function labelSource(id) {
  return SOURCES_VENTE.find((s) => s.id === id)?.label || id;
}

function formatMontant(n) {
  return n.toLocaleString(loc(), { style: "currency", currency: "CAD" });
}

export default function VentesSection({ entrepriseId }) {
  const { t } = useT();
  const [weekStart, setWeekStart] = useState(() => getDebutSemaine(new Date()));
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VIDE);
  const [saving, setSaving] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const sourceRef = useRef(null);
  useFermerAuClicExterieur(sourceRef, sourceOpen, () => setSourceOpen(false));
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [journees, setJournees] = useState([]); // journées importées de la semaine affichée
  const [datesImportees, setDatesImportees] = useState(new Set()); // toutes les journées importées (points du calendrier)
  const [importOuvert, setImportOuvert] = useState(false);
  const [dateImport, setDateImport] = useState("");
  const [jourOuvert, setJourOuvert] = useState(null);
  const [exportOuvert, setExportOuvert] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const exportRef = useRef(null);
  useFermerAuClicExterieur(exportRef, exportOuvert, () => setExportOuvert(false));

  const weekEnd = addDays(weekStart, 7);

  useEffect(() => {
    supabase
      .from("entreprises")
      .select("premier_jour_semaine")
      .eq("id", entrepriseId)
      .maybeSingle()
      .then(({ data }) => {
        const dimanche = data?.premier_jour_semaine === "dimanche";
        setWeekStart((w) => getDebutSemaine(addDays(w, 3), dimanche));
      });
  }, [entrepriseId]);

  useEffect(() => {
    load();
  }, [entrepriseId, weekStart]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("ventes")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date", weekStart.toISOString().slice(0, 10))
      .lt("date", weekEnd.toISOString().slice(0, 10))
      .order("date", { ascending: false });
    setVentes(data || []);
    const debut = weekStart.toISOString().slice(0, 10);
    const fin = weekEnd.toISOString().slice(0, 10);
    const { data: jours } = await supabase
      .from("ventes_jours")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date", debut)
      .lt("date", fin)
      .order("date", { ascending: false });
    setJournees(jours || []);
    const { data: toutes } = await supabase.from("ventes_jours").select("date").eq("entreprise_id", entrepriseId);
    setDatesImportees(new Set((toutes || []).map((j) => j.date)));
    setLoading(false);
  }

  function ouvrirImport() {
    setSyncMsg(null);
    setDateImport(decalerJour(dateAujourdhui(), -1)); // par défaut : la veille
    setImportOuvert(true);
  }

  // Importe UNE journée de ventes Wix : Gozly en garde le résumé (pas les transactions), voir /api/ventes/importer-jour.
  async function importerJournee() {
    if (!dateImport) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch("/api/ventes/importer-jour", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}` },
        body: JSON.stringify({ entrepriseId, date: dateImport }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setImportOuvert(false);
        await load();
        setJourOuvert(dateImport);
      } else {
        setSyncMsg({ type: "err", text: `${data.error || t("L'import a échoué.")}${data.detail ? ` [${data.detail}]` : ""}` });
      }
    } catch {
      setSyncMsg({ type: "err", text: t("L'import a échoué.") });
    }
    setSyncing(false);
  }

  // Rapport des journées importées de la semaine affichée ou du mois de cette semaine, en Excel (CSV) ou PDF.
  async function exporterPeriode(portee, format) {
    setExportOuvert(false);
    setExportEnCours(true);
    try {
      const milieu = addDays(weekStart, 3);
      const debut = portee === "mois" ? new Date(Date.UTC(milieu.getFullYear(), milieu.getMonth(), 1)) : weekStart;
      const fin = portee === "mois" ? new Date(Date.UTC(milieu.getFullYear(), milieu.getMonth() + 1, 1)) : weekEnd;
      const d1 = debut.toISOString().slice(0, 10);
      const d2 = fin.toISOString().slice(0, 10);
      const { data: jours } = await supabase.from("ventes_jours").select("*").eq("entreprise_id", entrepriseId).gte("date", d1).lt("date", d2).order("date");
      if (!jours || jours.length === 0) {
        setSyncMsg({ type: "err", text: t("Aucune journée importée sur cette période.") });
        return;
      }
      const nomBase = `ventes_${d1}_au_${decalerJour(d2, -1)}`;
      if (format === "csv") {
        telechargerFichier(`${nomBase}.csv`, journeesEnCsv(jours));
      } else {
        const { data: ent } = await supabase.from("entreprises").select("nom").eq("id", entrepriseId).maybeSingle();
        const doc = await pdfJournees({ entrepriseNom: ent?.nom || "", periodeLabel: `${d1} - ${decalerJour(d2, -1)}`, jours });
        doc.save(`${nomBase}.pdf`);
      }
    } finally {
      setExportEnCours(false);
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...FORM_VIDE, date: new Date().toISOString().slice(0, 10) });
    setSourceOpen(false);
    setModalOpen(true);
  }

  function openEdit(vente) {
    setEditingId(vente.id);
    setForm({
      source: vente.source,
      montant: String(vente.montant),
      date: vente.date,
      description: vente.description || "",
    });
    setSourceOpen(false);
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const montant = Number(form.montant);
    if (!form.date || !montant) return;
    setSaving(true);

    const valeurs = {
      source: form.source,
      montant,
      date: form.date,
      description: form.description.trim() || null,
    };

    if (editingId) {
      await supabase.from("ventes").update(valeurs).eq("id", editingId);
    } else {
      await supabase.from("ventes").insert({ entreprise_id: entrepriseId, ...valeurs });
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(id) {
    await supabase.from("ventes").delete().eq("id", id);
    load();
  }

  if (jourOuvert) {
    return <VentesJour entrepriseId={entrepriseId} date={jourOuvert} onRetour={() => setJourOuvert(null)} onChange={load} />;
  }

  const totauxParSource = SOURCES_VENTE.map((s) => ({
    ...s,
    total:
      ventes.filter((v) => v.source === s.id).reduce((sum, v) => sum + Number(v.montant), 0) +
      (s.id === "wix" ? journees.reduce((sum, j) => sum + Number(j.total_en_ligne), 0) : 0) +
      (s.id === "wix_pos" ? journees.reduce((sum, j) => sum + Number(j.total_comptoir), 0) : 0),
  })).filter((s) => s.total > 0);
  const totalGeneral = ventes.reduce((sum, v) => sum + Number(v.montant), 0) + journees.reduce((sum, j) => sum + totalJour(j), 0);

  const weekLabel = `${weekStart.toLocaleDateString(loc(), { day: "numeric", month: "long" })} - ${addDays(
    weekStart,
    6
  ).toLocaleDateString(loc(), { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2>{t("Suivi des ventes")}</h2>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="admin-icon-btn" onClick={ouvrirImport} disabled={syncing}>
            <IconIntegration className="gozly-icon" /> {t("Importer une journée Wix")}
          </button>
          <div className="account-wrap" ref={exportRef}>
            <button className="admin-icon-btn" onClick={() => setExportOuvert((v) => !v)} disabled={exportEnCours}>
              {exportEnCours ? "..." : <><IconTelecharger className="gozly-icon" /> {t("Exporter")} <IconFlecheBas className="gozly-icon-inline" /></>}
            </button>
            {exportOuvert && (
              <div className="account-dropdown open">
                <button type="button" className="menu-item" onClick={() => exporterPeriode("semaine", "csv")}>{t("Semaine - Excel (CSV)")}</button>
                <button type="button" className="menu-item" onClick={() => exporterPeriode("semaine", "pdf")}>{t("Semaine - PDF")}</button>
                <button type="button" className="menu-item" onClick={() => exporterPeriode("mois", "csv")}>{t("Mois - Excel (CSV)")}</button>
                <button type="button" className="menu-item" onClick={() => exporterPeriode("mois", "pdf")}>{t("Mois - PDF")}</button>
              </div>
            )}
          </div>
          <button className="submit-btn" onClick={openAdd}>
            {t("+ Ajouter une vente")}
          </button>
        </div>
      </div>

      {!importOuvert && syncMsg && <p className={`settings-msg ${syncMsg.type}`}>{syncMsg.text}</p>}

      <div className="planning-week-nav">
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          <IconFlecheGauche className="gozly-icon" />{" "}{t("Semaine précédente")}
        </button>
        <span className="planning-week-label">{weekLabel}</span>
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          {t("Semaine suivante")}{" "}<IconFlecheDroite className="gozly-icon" />
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>
      ) : ventes.length === 0 && journees.length === 0 ? (
        <div className="admin-list" style={{ maxWidth: "700px" }}>
          <div className="admin-empty">{t("Aucune vente cette semaine.")}</div>
        </div>
      ) : (
        <>
          <div className="admin-list" style={{ maxWidth: "500px", marginBottom: "24px" }}>
            {totauxParSource.map((s) => (
              <div className="admin-row" key={s.id}>
                <div className="admin-row-main">
                  <div className="admin-row-title">{t(s.label)}</div>
                </div>
                <div className="admin-row-controls">{formatMontant(s.total)}</div>
              </div>
            ))}
            <div className="admin-row">
              <div className="admin-row-main">
                <div className="admin-row-title">{t("Total")}</div>
              </div>
              <div className="admin-row-controls" style={{ fontWeight: 700 }}>
                {formatMontant(totalGeneral)}
              </div>
            </div>
          </div>

          {journees.length > 0 && (
            <>
              <h3 style={{ margin: "0 0 10px" }}>{t("Journées importées")}</h3>
              <div className="admin-list" style={{ maxWidth: "700px", marginBottom: "24px" }}>
                {journees.map((j) => {
                  const ecart = ecartMoneris(j);
                  return (
                    <div className="admin-row vj-ligne" key={j.id} role="button" tabIndex={0} onClick={() => setJourOuvert(j.date)} onKeyDown={(e) => e.key === "Enter" && setJourOuvert(j.date)}>
                      <div className="admin-row-main">
                        <div className="admin-row-title">
                          {new Date(j.date + "T00:00:00").toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" })}
                        </div>
                        <div className="admin-row-sub">
                          {t("{n} vente(s)", { n: j.nb_en_ligne + j.nb_comptoir })}
                          {" · "}
                          {j.conciliee ? t("Conciliée") : ecart === null ? t("À concilier") : Math.abs(ecart) < 0.005 ? t("Totaux concordants") : t("Écart : {m}", { m: formatMontant(ecart) })}
                        </div>
                      </div>
                      <div className="admin-row-controls">
                        {formatMontant(totalJour(j))} <IconFlecheDroite className="gozly-icon" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {ventes.length > 0 && <h3 style={{ margin: "0 0 10px" }}>{t("Ventes entrées à la main")}</h3>}
          <div className="admin-list" style={{ maxWidth: "700px" }}>
            {ventes.map((v) => (
              <div className="admin-row" key={v.id}>
                <div className="admin-row-main">
                  <div className="admin-row-title">
                    {formatMontant(v.montant)} · {labelSource(v.source)}
                  </div>
                  <div className="admin-row-sub">
                    {new Date(v.date + "T00:00:00").toLocaleDateString(loc(), {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    {v.description && ` · ${v.description}`}
                  </div>
                </div>
                <div className="admin-row-controls">
                  {v.source_id ? (
                    <span className="admin-row-sub">{t("Importée de Wix")}</span>
                  ) : (
                    <>
                      <button className="admin-icon-btn" onClick={() => openEdit(v)}>
                        {t("Modifier")}
                      </button>
                      <button className="admin-icon-btn danger" onClick={() => handleDelete(v.id)}>
                        {t("Retirer")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {importOuvert && (
        <div className="modal-overlay" onClick={() => setImportOuvert(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t("Importer une journée Wix")}</h3>
              <button className="admin-icon-btn" onClick={() => setImportOuvert(false)}>
                {t("Fermer")}
              </button>
            </div>
            <p className="section-hint" style={{ marginBottom: "12px" }}>
              {t("Choisis la journée à importer : Gozly lit toutes ses ventes chez Wix et en garde le résumé. Les transactions ne sont pas enregistrées.")}
            </p>
            <CalendrierJour value={dateImport} onChange={setDateImport} max={dateAujourdhui()} marquees={datesImportees} />
            {syncMsg && <p className={`settings-msg ${syncMsg.type}`}>{syncMsg.text}</p>}
            <div className="admin-edit-actions">
              <button type="button" className="submit-btn" onClick={importerJournee} disabled={syncing || !dateImport}>
                {syncing ? t("Import en cours...") : t("Importer le {date}", { date: dateImport ? new Date(dateImport + "T00:00:00").toLocaleDateString(loc(), { day: "numeric", month: "long" }) : "" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingId ? t("Modifier la vente") : t("Ajouter une vente")}</h3>
              <button className="admin-icon-btn" onClick={() => setModalOpen(false)}>
                {t("Fermer")}
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field-row">
                <div className="field">
                  <label>{t("Source")}</label>
                  <div className="emplacement-select-wrap" style={{ minWidth: 0 }} ref={sourceRef}>
                    <div
                      className={`emplacement-select-trigger${sourceOpen ? " open" : ""}`}
                      onClick={() => setSourceOpen((v) => !v)}
                    >
                      <span>{labelSource(form.source)}</span>
                      <span className="fs-arrow"><IconFlecheBas className="gozly-icon-inline" /></span>
                    </div>
                    {sourceOpen && (
                      <div className="emplacement-select-options">
                        {SOURCES_VENTE.map((s) => (
                          <div
                            key={s.id}
                            className={`emplacement-select-option${s.id === form.source ? " active" : ""}`}
                            onClick={() => {
                              setForm((f) => ({ ...f, source: s.id }));
                              setSourceOpen(false);
                            }}
                          >
                            {t(s.label)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="field">
                  <label>{t("Montant")}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.montant}
                    onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label>{t("Date")}</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>

              <div className="field">
                <label>{t("Description (optionnel)")}</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder={t("Ex: référence de transaction")}
                />
              </div>

              <div className="admin-edit-actions">
                <button type="submit" className="submit-btn" disabled={saving}>
                  {saving ? t("Enregistrement...") : editingId ? t("Enregistrer") : t("Ajouter")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
