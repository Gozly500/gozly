"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EmplacementSelect from "@/components/EmplacementSelect";
import { getDebutSemaine, addDays } from "@/lib/semaine";
import SimpleSelect from "@/components/SimpleSelect";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

export default function HoraireSection({ entrepriseId }) {
  const [weekStart, setWeekStart] = useState(() => getDebutSemaine(new Date()));
  const [employes, setEmployes] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [quarts, setQuarts] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [modal, setModal] = useState(null); // { date, employeId, quartId, heureDebut, heureFin }
  const [publishing, setPublishing] = useState(false);
  const [premierJourDimanche, setPremierJourDimanche] = useState(false);
  const [importModal, setImportModal] = useState(null); // { dateSource, confirmerRemplacement, error }
  const [importing, setImporting] = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    supabase
      .from("emplacements")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setEmplacements(data || []);
        if (data && data.length > 0) setEmplacementId((cur) => cur || data[0].id);
      });
  }, [entrepriseId]);

  useEffect(() => {
    supabase
      .from("entreprises")
      .select("premier_jour_semaine")
      .eq("id", entrepriseId)
      .maybeSingle()
      .then(({ data }) => {
        const dimanche = data?.premier_jour_semaine === "dimanche";
        setPremierJourDimanche(dimanche);
        setWeekStart((w) => getDebutSemaine(addDays(w, 3), dimanche));
      });
  }, [entrepriseId]);

  useEffect(() => {
    load();
  }, [entrepriseId, weekStart, emplacementId]);

  async function load() {
    setLoading(true);
    const { data: employesData } = await supabase
      .from("employes")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("nom", { ascending: true });

    let quartsQuery = supabase
      .from("planning_quarts")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date", toISODate(weekStart))
      .lte("date", toISODate(weekEnd))
      .order("heure_debut", { ascending: true });

    quartsQuery = emplacements.length > 0 ? quartsQuery.eq("emplacement_id", emplacementId) : quartsQuery;

    const { data: quartsData } = await quartsQuery;

    if (employesData && employesData.length > 0) {
      const { data: assocData } = await supabase
        .from("employe_emplacements")
        .select("*")
        .in("employe_id", employesData.map((e) => e.id));
      setAssociations(assocData || []);
    } else {
      setAssociations([]);
    }

    setEmployes(employesData || []);
    setQuarts(quartsData || []);
    setLoading(false);
  }

  function employeNom(id) {
    return employes.find((e) => e.id === id)?.nom || "Employé retiré";
  }

  // Un employé sans aucun emplacement assigné est considéré disponible
  // partout. Un employé avec des emplacements assignés n'apparaît que
  // dans ceux-là.
  const employesVisibles =
    emplacements.length === 0 || !emplacementId
      ? employes
      : employes.filter((emp) => {
          const assignes = associations.filter((a) => a.employe_id === emp.id).map((a) => a.emplacement_id);
          return assignes.length === 0 || assignes.includes(emplacementId);
        });

  function handleDrop(e, dateISO) {
    e.preventDefault();
    setDragOverDate(null);
    const employeId = e.dataTransfer.getData("text/plain");
    if (!employeId) return;
    setModal({ date: dateISO, employeId, quartId: null, heureDebut: "09:00", heureFin: "17:00", poste: "" });
  }

  function openAddViaButton(dateISO) {
    setModal({
      date: dateISO,
      employeId: employesVisibles[0]?.id || "",
      quartId: null,
      heureDebut: "09:00",
      heureFin: "17:00",
      poste: "",
    });
  }

  function openEdit(quart) {
    setModal({
      date: quart.date,
      employeId: quart.employe_id,
      quartId: quart.id,
      heureDebut: quart.heure_debut.slice(0, 5),
      heureFin: quart.heure_fin.slice(0, 5),
      poste: quart.poste || "",
    });
  }

  async function handleSaveModal(e) {
    e.preventDefault();
    if (!modal.employeId) return;

    const poste = modal.poste?.trim() || null;

    if (modal.quartId) {
      await supabase
        .from("planning_quarts")
        .update({ employe_id: modal.employeId, heure_debut: modal.heureDebut, heure_fin: modal.heureFin, poste })
        .eq("id", modal.quartId);
    } else {
      await supabase.from("planning_quarts").insert({
        entreprise_id: entrepriseId,
        employe_id: modal.employeId,
        date: modal.date,
        heure_debut: modal.heureDebut,
        heure_fin: modal.heureFin,
        poste,
        emplacement_id: emplacementId,
      });
    }

    setModal(null);
    load();
  }

  async function handleDeleteModal() {
    if (!modal.quartId) return;
    await supabase.from("planning_quarts").delete().eq("id", modal.quartId);
    setModal(null);
    load();
  }

  async function handlePublierSemaine() {
    setPublishing(true);
    let query = supabase
      .from("planning_quarts")
      .update({ publie: true })
      .eq("entreprise_id", entrepriseId)
      .gte("date", toISODate(weekStart))
      .lte("date", toISODate(weekEnd));
    if (emplacements.length > 0) query = query.eq("emplacement_id", emplacementId);
    await query;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    fetch("/api/notifications/semaine-publiee", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        entrepriseId,
        dateDebut: toISODate(weekStart),
        dateFin: toISODate(weekEnd),
        emplacementId: emplacements.length > 0 ? emplacementId : null,
      }),
    }).catch(() => {});

    setPublishing(false);
    load();
  }

  function openImportModal() {
    setImportModal({ dateSource: toISODate(addDays(weekStart, -7)), confirmerRemplacement: false, error: null });
  }

  async function handleImporterSemaine(e) {
    e.preventDefault();
    if (!importModal?.dateSource) return;

    const sourceWeekStart = getDebutSemaine(new Date(`${importModal.dateSource}T00:00:00`), premierJourDimanche);
    const sourceWeekEnd = addDays(sourceWeekStart, 6);

    if (toISODate(sourceWeekStart) === toISODate(weekStart)) {
      setImportModal((m) => ({ ...m, error: "Choisis une semaine différente de celle affichée en ce moment." }));
      return;
    }

    // La semaine affichée a déjà des quarts : on demande une confirmation
    // explicite avant de les remplacer, plutôt que d'empiler les deux.
    if (quarts.length > 0 && !importModal.confirmerRemplacement) {
      setImportModal((m) => ({ ...m, confirmerRemplacement: true, error: null }));
      return;
    }

    setImporting(true);
    setImportModal((m) => ({ ...m, error: null }));

    let sourceQuery = supabase
      .from("planning_quarts")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date", toISODate(sourceWeekStart))
      .lte("date", toISODate(sourceWeekEnd));
    sourceQuery = emplacements.length > 0 ? sourceQuery.eq("emplacement_id", emplacementId) : sourceQuery;
    const { data: quartsSource } = await sourceQuery;

    if (!quartsSource || quartsSource.length === 0) {
      setImporting(false);
      setImportModal((m) => ({ ...m, error: "Aucun quart trouvé pour cette semaine-là." }));
      return;
    }

    if (quarts.length > 0) {
      let delQuery = supabase
        .from("planning_quarts")
        .delete()
        .eq("entreprise_id", entrepriseId)
        .gte("date", toISODate(weekStart))
        .lte("date", toISODate(weekEnd));
      delQuery = emplacements.length > 0 ? delQuery.eq("emplacement_id", emplacementId) : delQuery;
      await delQuery;
    }

    const copies = quartsSource.map((q) => {
      const decalageJours = Math.round((new Date(q.date) - sourceWeekStart) / 86400000);
      return {
        entreprise_id: entrepriseId,
        employe_id: q.employe_id,
        date: toISODate(addDays(weekStart, decalageJours)),
        heure_debut: q.heure_debut,
        heure_fin: q.heure_fin,
        poste: q.poste,
        emplacement_id: q.emplacement_id,
        publie: false,
      };
    });

    await supabase.from("planning_quarts").insert(copies);

    setImporting(false);
    setImportModal(null);
    load();
  }

  const weekLabel = `${weekStart.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} - ${weekEnd.toLocaleDateString(
    "fr-CA",
    { day: "numeric", month: "long", year: "numeric" }
  )}`;

  return (
    <div>
      <EmplacementSelect emplacements={emplacements} value={emplacementId} onChange={setEmplacementId} />

      <div className="planning-week-nav">
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          ‹ Semaine précédente
        </button>
        <span className="planning-week-label">{weekLabel}</span>
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          Semaine suivante ›
        </button>
        <button className="admin-icon-btn" style={{ marginLeft: "auto" }} onClick={openImportModal}>
          📋 Importer une semaine
        </button>
        <button
          className="submit-btn"
          onClick={handlePublierSemaine}
          disabled={publishing || quarts.length === 0 || quarts.every((q) => q.publie)}
        >
          {publishing ? "Publication..." : "📢 Publier la semaine"}
        </button>
      </div>
      {quarts.some((q) => !q.publie) && (
        <p className="section-hint" style={{ marginBottom: "10px" }}>
          Les quarts marqués <strong>Brouillon</strong> ne sont pas encore visibles des employés - clique "Publier la
          semaine" quand l'horaire est prêt.
        </p>
      )}

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : employes.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>
          Ajoute d'abord des employés dans Entreprise → Employés pour pouvoir les placer dans l'horaire.
        </p>
      ) : employesVisibles.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>Aucun employé assigné à cet emplacement pour l'instant.</p>
      ) : (
        <>
          <p className="section-hint" style={{ marginBottom: "14px" }}>
            Glisse un employé sur une journée pour lui assigner un quart.
          </p>
          <div className="horaire-layout">
            <div className="horaire-employees">
              {employesVisibles.map((emp) => (
                <div
                  key={emp.id}
                  className="horaire-employee-pill"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", emp.id)}
                >
                  {emp.nom}
                </div>
              ))}
            </div>

            <div className="horaire-grid">
              {weekDays.map((day) => {
                const dateISO = toISODate(day);
                const dayQuarts = quarts.filter((q) => q.date === dateISO);

                return (
                  <div
                    key={dateISO}
                    className={`horaire-col${dragOverDate === dateISO ? " drag-over" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverDate(dateISO);
                    }}
                    onDragLeave={() => setDragOverDate((d) => (d === dateISO ? null : d))}
                    onDrop={(e) => handleDrop(e, dateISO)}
                  >
                    <div className="horaire-col-head">
                      <div className="horaire-col-day">{JOURS[(day.getDay() + 6) % 7]}</div>
                      <div className="horaire-col-date">{day.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}</div>
                    </div>

                    {dayQuarts.map((q) => (
                      <div className={`horaire-chip${q.publie ? "" : " brouillon"}`} key={q.id} onClick={() => openEdit(q)}>
                        <div className="horaire-chip-nom">
                          {employeNom(q.employe_id)}
                          {!q.publie && <span className="horaire-chip-badge">Brouillon</span>}
                        </div>
                        <div className="horaire-chip-heures">
                          {q.heure_debut.slice(0, 5)} - {q.heure_fin.slice(0, 5)}
                        </div>
                        {q.poste && <div className="horaire-chip-poste">{q.poste}</div>}
                      </div>
                    ))}

                    <button className="horaire-col-add" onClick={() => openAddViaButton(dateISO)}>
                      + Ajouter
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" style={{ maxWidth: "360px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal.quartId ? "Modifier le quart" : "Nouveau quart"}</h3>
              <button className="admin-icon-btn" onClick={() => setModal(null)}>
                Fermer
              </button>
            </div>
            <form onSubmit={handleSaveModal}>
              <div className="field">
                <label>Employé</label>
                {modal.quartId || employes.find((e) => e.id === modal.employeId) ? (
                  <SimpleSelect
                    options={(employesVisibles.some((e) => e.id === modal.employeId)
                      ? employesVisibles
                      : [...employesVisibles, employes.find((e) => e.id === modal.employeId)].filter(Boolean)
                    ).map((emp) => ({ id: emp.id, label: emp.nom }))}
                    value={modal.employeId}
                    onChange={(id) => setModal((m) => ({ ...m, employeId: id }))}
                  />
                ) : (
                  <div style={{ fontWeight: 600 }}>{employeNom(modal.employeId)}</div>
                )}
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Début</label>
                  <input
                    type="time"
                    value={modal.heureDebut}
                    onChange={(e) => setModal((m) => ({ ...m, heureDebut: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>Fin</label>
                  <input
                    type="time"
                    value={modal.heureFin}
                    onChange={(e) => setModal((m) => ({ ...m, heureFin: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label>Poste (optionnel)</label>
                <input
                  type="text"
                  value={modal.poste}
                  onChange={(e) => setModal((m) => ({ ...m, poste: e.target.value }))}
                  placeholder="Ex: Machine 3, Cuisine, Caisse..."
                />
              </div>
              <div className="admin-edit-actions">
                <button type="submit" className="submit-btn">
                  {modal.quartId ? "Enregistrer" : "Ajouter"}
                </button>
                {modal.quartId && (
                  <button type="button" className="btn-danger" onClick={handleDeleteModal}>
                    Retirer ce quart
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {importModal && (
        <div className="modal-overlay" onClick={() => !importing && setImportModal(null)}>
          <div className="modal-card" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Importer une semaine</h3>
              <button className="admin-icon-btn" onClick={() => setImportModal(null)} disabled={importing}>
                Fermer
              </button>
            </div>
            <p className="section-hint" style={{ marginBottom: "14px" }}>
              Copie tous les quarts d'une semaine existante vers la semaine affichée ({weekLabel}). Les quarts copiés
              restent en <strong>Brouillon</strong> - tu peux les ajuster avant de publier.
            </p>
            <form onSubmit={handleImporterSemaine}>
              <div className="field">
                <label>N'importe quelle date dans la semaine à copier</label>
                <input
                  type="date"
                  value={importModal.dateSource}
                  onChange={(e) => setImportModal((m) => ({ ...m, dateSource: e.target.value, confirmerRemplacement: false, error: null }))}
                  required
                />
              </div>

              {importModal.confirmerRemplacement && (
                <p className="settings-msg err">
                  La semaine affichée a déjà des quarts - ils seront tous supprimés et remplacés par la copie. Clique
                  à nouveau sur "Importer" pour confirmer.
                </p>
              )}
              {importModal.error && <p className="settings-msg err">{importModal.error}</p>}

              <div className="admin-edit-actions">
                <button type="submit" className="submit-btn" disabled={importing}>
                  {importing ? "Importation..." : importModal.confirmerRemplacement ? "Confirmer le remplacement" : "Importer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
