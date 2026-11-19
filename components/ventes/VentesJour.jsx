"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";
import { IconFlecheBas, IconFlecheGauche, IconTelecharger, IconRafraichir, IconCorbeille } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";
import { loc } from "@/lib/i18n/locale";
import { telechargerFichier } from "@/lib/temperature";
import { ecartMoneris, pdfJournee, totalCarte, totalJour, transactionsEnCsv } from "@/lib/ventesExport";

function formatMontant(n) {
  return Number(n || 0).toLocaleString(loc(), { style: "currency", currency: "CAD" });
}

function heureLocale(iso) {
  return new Intl.DateTimeFormat(loc(), { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

// La page d'UNE journée : résumé gardé chez Gozly + transactions relues chez Wix à l'ouverture (jamais stockées),
// et la conciliation (total Moneris, écart, « conciliée »).
export default function VentesJour({ entrepriseId, date, onRetour, onChange }) {
  const { t } = useT();
  const [jour, setJour] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [erreurWix, setErreurWix] = useState(null);
  const [filtre, setFiltre] = useState("toutes");
  const [moneris, setMoneris] = useState("");
  const [conciliee, setConciliee] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(null);
  const [occupe, setOccupe] = useState(null);
  const [entrepriseNom, setEntrepriseNom] = useState("");
  const [exportOuvert, setExportOuvert] = useState(false);
  const [confirmerSuppr, setConfirmerSuppr] = useState(false);
  const exportRef = useRef(null);
  useFermerAuClicExterieur(exportRef, exportOuvert, () => setExportOuvert(false));

  const dateLabel = new Date(`${date}T00:00:00`).toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  async function entetes() {
    const { data } = await supabase.auth.getSession();
    return { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token}` };
  }

  function appliquer(ligne) {
    setJour(ligne);
    setMoneris(ligne?.moneris_total === null || ligne?.moneris_total === undefined ? "" : String(ligne.moneris_total));
    setConciliee(!!ligne?.conciliee);
    setNote(ligne?.note || "");
  }

  // La liste est gardée en mémoire le temps de l'onglet (sessionStorage) : rouvrir une journée déjà vue ne rappelle pas Wix.
  // « Actualiser depuis Wix » force une nouvelle lecture. Rien n'est enregistré chez Gozly.
  const cleCache = `gozly_ventes_jour_${entrepriseId}_${date}`;

  async function chargerTransactions(forcer = false) {
    setErreurWix(null);
    if (!forcer) {
      try {
        const garde = JSON.parse(window.sessionStorage.getItem(cleCache) || "null");
        if (garde?.transactions) {
          setTransactions(garde.transactions);
          return;
        }
      } catch {}
    }
    setTransactions(null);
    try {
      const res = await fetch(`/api/ventes/jour?entrepriseId=${entrepriseId}&date=${date}`, { headers: await entetes() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("La lecture des ventes chez Wix a échoué."));
      setTransactions(data.transactions || []);
      try {
        window.sessionStorage.setItem(cleCache, JSON.stringify({ transactions: data.transactions || [] }));
      } catch {}
    } catch (err) {
      setTransactions([]);
      setErreurWix(err.message);
    }
  }

  useEffect(() => {
    supabase
      .from("ventes_jours")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .eq("date", date)
      .eq("source", "wix")
      .maybeSingle()
      .then(({ data }) => appliquer(data));
    supabase.from("entreprises").select("nom").eq("id", entrepriseId).maybeSingle().then(({ data }) => setEntrepriseNom(data?.nom || ""));
    chargerTransactions();
  }, [entrepriseId, date]);

  async function enregistrerConciliation() {
    if (!jour) return;
    setOccupe("conciliation");
    setMsg(null);
    const valeur = moneris.trim() === "" ? null : Number(String(moneris).replace(",", "."));
    if (valeur !== null && Number.isNaN(valeur)) {
      setMsg({ type: "err", text: t("Le total Moneris n'est pas un nombre valide.") });
      setOccupe(null);
      return;
    }
    const { data, error } = await supabase
      .from("ventes_jours")
      .update({ moneris_total: valeur, conciliee, note: note.trim() || null })
      .eq("id", jour.id)
      .select("*")
      .maybeSingle();
    setOccupe(null);
    if (error) {
      setMsg({ type: "err", text: t("L'enregistrement a échoué.") });
      return;
    }
    appliquer(data);
    onChange?.();
    setMsg({ type: "ok", text: t("Conciliation enregistrée.") });
  }

  async function reimporter() {
    setOccupe("import");
    setMsg(null);
    try {
      const res = await fetch("/api/ventes/importer-jour", { method: "POST", headers: await entetes(), body: JSON.stringify({ entrepriseId, date }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${data.error || t("L'import a échoué.")}${data.detail ? ` [${data.detail}]` : ""}`);
      appliquer(data.jour);
      onChange?.();
      setMsg({ type: "ok", text: t("Journée mise à jour depuis Wix.") });
      chargerTransactions(true);
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
    setOccupe(null);
  }

  // Supprime le résumé de cette journée (les transactions ne sont de toute façon pas gardées) ; on peut la réimporter.
  async function supprimerImport() {
    if (!jour) return;
    setOccupe("suppression");
    const { error } = await supabase.from("ventes_jours").delete().eq("id", jour.id);
    setOccupe(null);
    if (error) {
      setMsg({ type: "err", text: t("La suppression a échoué.") });
      return;
    }
    try {
      window.sessionStorage.removeItem(cleCache);
    } catch {}
    onChange?.();
    onRetour();
  }

  async function exporter(format) {
    setExportOuvert(false);
    if (!jour || !transactions) return;
    if (format === "csv") {
      telechargerFichier(`ventes_${date}.csv`, transactionsEnCsv(date, transactions));
      return;
    }
    setOccupe("pdf");
    try {
      const doc = await pdfJournee({ entrepriseNom, dateLabel, resume: jour, transactions });
      doc.save(`ventes-${date}.pdf`);
    } finally {
      setOccupe(null);
    }
  }

  const ecart = jour ? ecartMoneris({ ...jour, moneris_total: moneris.trim() === "" ? null : Number(String(moneris).replace(",", ".")) }) : null;
  const visibles = (transactions || []).filter((x) => filtre === "toutes" || x.canal === filtre);
  const modes = Object.entries(jour?.par_paiement || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="vj">
      <div className="vj-tete">
        <button type="button" className="admin-icon-btn" onClick={onRetour}>
          <IconFlecheGauche className="gozly-icon" /> {t("Retour")}
        </button>
        <h2>{dateLabel}</h2>
        <div className="vj-actions">
          <button type="button" className="admin-icon-btn" onClick={reimporter} disabled={occupe === "import"}>
            <IconRafraichir className="gozly-icon" /> {occupe === "import" ? t("Import en cours...") : t("Actualiser depuis Wix")}
          </button>
          {confirmerSuppr ? (
            <>
              <button type="button" className="admin-icon-btn danger" onClick={supprimerImport} disabled={occupe === "suppression"}>
                {occupe === "suppression" ? "..." : t("Confirmer la suppression")}
              </button>
              <button type="button" className="admin-icon-btn" onClick={() => setConfirmerSuppr(false)}>
                {t("Annuler")}
              </button>
            </>
          ) : (
            <button type="button" className="admin-icon-btn danger" onClick={() => setConfirmerSuppr(true)} disabled={!jour}>
              <IconCorbeille className="gozly-icon" /> {t("Supprimer l'import")}
            </button>
          )}
          <div className="account-wrap" ref={exportRef}>
            <button type="button" className="admin-icon-btn" onClick={() => setExportOuvert((v) => !v)} disabled={!jour || !transactions || occupe === "pdf"}>
              <IconTelecharger className="gozly-icon" /> {occupe === "pdf" ? "PDF..." : t("Exporter")} <IconFlecheBas className="gozly-icon-inline" />
            </button>
            {exportOuvert && (
              <div className="account-dropdown open">
                <button type="button" className="menu-item" onClick={() => exporter("csv")}>
                  {t("Excel (CSV)")}
                </button>
                <button type="button" className="menu-item" onClick={() => exporter("pdf")}>
                  {t("PDF")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}

      {!jour ? (
        <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>
      ) : (
        <>
          <div className="vj-cartes">
            <div className="vj-carte">
              <span>{t("Total de la journée")}</span>
              <strong>{formatMontant(totalJour(jour))}</strong>
              <small>{t("{n} vente(s)", { n: jour.nb_en_ligne + jour.nb_comptoir })}</small>
            </div>
            <div className="vj-carte">
              <span>{t("En ligne")}</span>
              <strong>{formatMontant(jour.total_en_ligne)}</strong>
              <small>{t("{n} vente(s)", { n: jour.nb_en_ligne })}</small>
            </div>
            <div className="vj-carte">
              <span>{t("Au comptoir")}</span>
              <strong>{formatMontant(jour.total_comptoir)}</strong>
              <small>{t("{n} vente(s)", { n: jour.nb_comptoir })}</small>
            </div>
            <div className="vj-carte">
              <span>{t("Taxes")}</span>
              <strong>{formatMontant(jour.taxes)}</strong>
              <small>{t("Remboursements : {m}", { m: formatMontant(jour.remboursements) })}</small>
            </div>
          </div>

          <div className="vj-deux">
            <div className="admin-list">
              <div className="admin-row">
                <div className="admin-row-main">
                  <div className="admin-row-title">{t("Par mode de paiement")}</div>
                </div>
              </div>
              {modes.length === 0 ? (
                <div className="admin-empty">{t("Aucune vente ce jour-là.")}</div>
              ) : (
                modes.map(([mode, montant]) => (
                  <div className="admin-row" key={mode}>
                    <div className="admin-row-main">
                      <div className="admin-row-title">{t(mode)}</div>
                    </div>
                    <div className="admin-row-controls">{formatMontant(montant)}</div>
                  </div>
                ))
              )}
              {Number(jour.pourboires) > 0 && (
                <div className="admin-row">
                  <div className="admin-row-main">
                    <div className="admin-row-title">{t("Pourboires")}</div>
                  </div>
                  <div className="admin-row-controls">{formatMontant(jour.pourboires)}</div>
                </div>
              )}
            </div>

            <div className="admin-list vj-concilier">
              <div className="admin-row">
                <div className="admin-row-main">
                  <div className="admin-row-title">{t("Conciliation")}</div>
                  <div className="admin-row-sub">{t("Compare le total « carte » de Wix au rapport Moneris de la journée.")}</div>
                </div>
              </div>
              <div className="vj-concilier-corps">
                <div className="field">
                  <label>{t("Total carte selon Wix")}</label>
                  <input type="text" value={formatMontant(totalCarte(jour))} readOnly />
                </div>
                <div className="field">
                  <label>{t("Total du rapport Moneris")}</label>
                  <input type="text" inputMode="decimal" value={moneris} onChange={(e) => setMoneris(e.target.value)} placeholder="0.00" />
                </div>
                {ecart !== null && (
                  <p className={`vj-ecart ${Math.abs(ecart) < 0.005 ? "ok" : "err"}`}>
                    {Math.abs(ecart) < 0.005 ? t("Aucun écart : les totaux concordent.") : t("Écart : {m} (Moneris moins Wix)", { m: formatMontant(ecart) })}
                  </p>
                )}
                <div className="field">
                  <label>{t("Note (optionnel)")}</label>
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Ex: remboursement du 17 non encore passé")} />
                </div>
                <label className="vj-conciliee">
                  <input type="checkbox" checked={conciliee} onChange={(e) => setConciliee(e.target.checked)} /> {t("Journée conciliée")}
                </label>
                <button type="button" className="submit-btn" onClick={enregistrerConciliation} disabled={occupe === "conciliation"}>
                  {occupe === "conciliation" ? t("Enregistrement...") : t("Enregistrer")}
                </button>
              </div>
            </div>
          </div>

          <div className="vj-liste-tete">
            <h3>{t("Transactions")}</h3>
            <div className="vj-filtres">
              {[
                ["toutes", t("Toutes")],
                ["en_ligne", t("En ligne")],
                ["comptoir", t("Comptoir")],
              ].map(([id, label]) => (
                <button key={id} type="button" className={`admin-icon-btn${filtre === id ? " on" : ""}`} onClick={() => setFiltre(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {erreurWix && <p className="settings-msg err">{erreurWix}</p>}
          {transactions === null ? (
            <p style={{ color: "var(--text-dim)" }}>{t("Chargement des transactions chez Wix...")}</p>
          ) : visibles.length === 0 ? (
            <div className="admin-list">
              <div className="admin-empty">{t("Aucune transaction.")}</div>
            </div>
          ) : (
            <div className="vj-table-wrap">
              <table className="vj-table">
                <thead>
                  <tr>
                    <th>{t("Heure")}</th>
                    <th>{t("Canal")}</th>
                    <th>{t("Numéro")}</th>
                    <th>{t("Paiement")}</th>
                    <th>{t("Statut")}</th>
                    <th className="droite">{t("Net")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((x) => (
                    <tr key={x.id} className={x.comptee ? "" : "non-comptee"}>
                      <td>{heureLocale(x.heure)}</td>
                      <td>{x.canal === "comptoir" ? t("Comptoir") : t("En ligne")}</td>
                      <td>{x.numero ? `#${x.numero}` : ""}</td>
                      <td>{x.methode ? t(x.methode) : ""}</td>
                      <td>{x.statut ? t(x.statut) : ""}</td>
                      <td className="droite">{formatMontant(x.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
