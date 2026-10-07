"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EmplacementSelect from "@/components/EmplacementSelect";
import { getDebutSemaine, addDays } from "@/lib/semaine";
import { useFermerAuClicExterieur } from "@/lib/useFermerAuClicExterieur";
import { useGestion } from "@/components/gestion/GestionShell";
import { IconCrayon, IconFlecheBas, IconFlecheDroite, IconFlecheGauche } from "@/components/icons/Pictogrammes";

function dateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function heure(t) {
  return t ? t.slice(0, 5) : "";
}

// Menu déroulant maison pour choisir l'employé (pas de <select> natif).
function ChoixEmploye({ employes, value, onChange }) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);
  useFermerAuClicExterieur(ref, ouvert, () => setOuvert(false));
  const courant = employes.find((e) => e.id === value);
  return (
    <div className="emplacement-select-wrap" ref={ref} style={{ marginBottom: 0 }}>
      <div className={`emplacement-select-trigger${ouvert ? " open" : ""}`} onClick={() => setOuvert((v) => !v)}>
        <span>{courant?.nom || "Choisis un employé"}</span>
        <span className="fs-arrow"><IconFlecheBas className="gozly-icon-inline" /></span>
      </div>
      {ouvert && (
        <div className="emplacement-select-options" style={{ maxHeight: "240px", overflowY: "auto" }}>
          {employes.map((e) => (
            <div
              key={e.id}
              className={`emplacement-select-option${e.id === value ? " active" : ""}`}
              onClick={() => {
                onChange(e.id);
                setOuvert(false);
              }}
            >
              {e.nom}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Horaire pour le téléphone : les quarts de la semaine, jour par jour. Avec la permission « Gérer l'horaire »,
// un bouton Modifier fait apparaître un crayon sur chaque quart et « + Ajouter » sur chaque journée.
export default function HoraireMobile() {
  const { entrepriseId, a } = useGestion();
  const peutModifier = a("gerer_horaire");
  const [weekStart, setWeekStart] = useState(() => getDebutSemaine(new Date()));
  const [employes, setEmployes] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [quarts, setQuarts] = useState([]);
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementId] = useState(null); // null = toutes
  const [loading, setLoading] = useState(true);
  const [edition, setEdition] = useState(false);
  const [modal, setModal] = useState(null); // { date, quartId, employeId, heureDebut, heureFin, poste, emplacementId }
  const [saving, setSaving] = useState(false);
  const [publication, setPublication] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    supabase
      .from("emplacements")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setEmplacements(data || []));

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

  const charger = useCallback(async () => {
    const { data: employesData } = await supabase
      .from("employes")
      .select("id, nom")
      .eq("entreprise_id", entrepriseId)
      .order("nom", { ascending: true });

    let q = supabase
      .from("planning_quarts")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date", dateStr(weekStart))
      .lte("date", dateStr(addDays(weekStart, 6)))
      .order("heure_debut", { ascending: true });
    if (emplacementId) q = q.eq("emplacement_id", emplacementId);
    const { data: quartsData } = await q;

    let assoc = [];
    if ((employesData || []).length > 0) {
      const { data } = await supabase.from("employe_emplacements").select("*").in("employe_id", employesData.map((e) => e.id));
      assoc = data || [];
    }

    setEmployes(employesData || []);
    setAssociations(assoc);
    setQuarts(quartsData || []);
    setLoading(false);
  }, [entrepriseId, weekStart, emplacementId]);

  useEffect(() => {
    setLoading(true);
    charger();
  }, [charger]);

  const jours = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const aujourdhui = dateStr(new Date());
  const nomEmploye = (id) => employes.find((e) => e.id === id)?.nom || "Employé";
  const nomEmplacement = (id) => emplacements.find((e) => e.id === id)?.nom;

  // Succursale où ajouter un quart : l'unique succursale, ou celle choisie. Plusieurs succursales et aucune choisie : on ne peut pas ajouter.
  const emplacementCible = emplacements.length === 0 ? null : emplacements.length === 1 ? emplacements[0].id : emplacementId;
  const peutAjouter = emplacements.length <= 1 || !!emplacementId;
  const brouillons = quarts.filter((q) => !q.publie).length;

  // Un employé sans succursale assignée est disponible partout ; sinon seulement dans les siennes.
  function employesPour(idEmplacement) {
    if (!idEmplacement) return employes;
    return employes.filter((emp) => {
      const assignes = associations.filter((x) => x.employe_id === emp.id).map((x) => x.emplacement_id);
      return assignes.length === 0 || assignes.includes(idEmplacement);
    });
  }

  function ouvrirAjout(date) {
    setMessage(null);
    setModal({ date, quartId: null, employeId: employesPour(emplacementCible)[0]?.id || "", heureDebut: "09:00", heureFin: "17:00", poste: "", emplacementId: emplacementCible });
  }

  function ouvrirModif(q) {
    setMessage(null);
    setModal({ date: q.date, quartId: q.id, employeId: q.employe_id, heureDebut: heure(q.heure_debut), heureFin: heure(q.heure_fin), poste: q.poste || "", emplacementId: q.emplacement_id || null });
  }

  async function enregistrer(e) {
    e.preventDefault();
    if (!modal.employeId) return;
    setSaving(true);
    const poste = modal.poste?.trim() || null;
    if (modal.quartId) {
      await supabase.from("planning_quarts").update({ employe_id: modal.employeId, heure_debut: modal.heureDebut, heure_fin: modal.heureFin, poste }).eq("id", modal.quartId);
    } else {
      await supabase.from("planning_quarts").insert({
        entreprise_id: entrepriseId,
        employe_id: modal.employeId,
        date: modal.date,
        heure_debut: modal.heureDebut,
        heure_fin: modal.heureFin,
        poste,
        emplacement_id: modal.emplacementId,
      });
    }
    setSaving(false);
    setModal(null);
    charger();
  }

  async function retirer() {
    if (!modal.quartId) return;
    if (!window.confirm("Retirer ce quart?")) return;
    await supabase.from("planning_quarts").delete().eq("id", modal.quartId);
    setModal(null);
    charger();
  }

  // Les nouveaux quarts sont des brouillons : les employés ne les voient (et ne sont avertis) qu'à la publication.
  async function publier() {
    setPublication(true);
    let q = supabase
      .from("planning_quarts")
      .update({ publie: true })
      .eq("entreprise_id", entrepriseId)
      .gte("date", dateStr(weekStart))
      .lte("date", dateStr(addDays(weekStart, 6)));
    if (emplacements.length > 0) q = q.eq("emplacement_id", emplacementId);
    await q;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    fetch("/api/notifications/semaine-publiee", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        entrepriseId,
        dateDebut: dateStr(weekStart),
        dateFin: dateStr(addDays(weekStart, 6)),
        emplacementId: emplacements.length > 0 ? emplacementId : null,
      }),
    }).catch(() => {});

    setPublication(false);
    setMessage({ type: "ok", text: "Semaine publiée : les employés sont avertis." });
    charger();
  }

  const libelleSemaine = `${weekStart.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} - ${addDays(weekStart, 6).toLocaleDateString(
    "fr-CA",
    { day: "numeric", month: "long" }
  )}`;

  return (
    <div>
      <div className="moi-week-nav">
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          <IconFlecheGauche className="gozly-icon" />
        </button>
        <span className="moi-week-label">{libelleSemaine}</span>
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          <IconFlecheDroite className="gozly-icon" />
        </button>
      </div>

      <EmplacementSelect emplacements={emplacements} value={emplacementId} onChange={setEmplacementId} includeToutes />

      {peutModifier && (
        <div className="gestion-horaire-barre">
          <button type="button" className={edition ? "btn-small" : "admin-icon-btn"} onClick={() => setEdition((v) => !v)}>
            {edition ? "Terminer" : <><IconCrayon className="gozly-icon" /> Modifier</>}
          </button>
          {edition && brouillons > 0 && (
            <button type="button" className="btn-small" onClick={publier} disabled={publication || !peutAjouter}>
              {publication ? "Publication..." : `Publier (${brouillons} brouillon${brouillons > 1 ? "s" : ""})`}
            </button>
          )}
        </div>
      )}
      {edition && !peutAjouter && <p className="section-hint">Choisis une succursale pour ajouter un quart ou publier la semaine.</p>}
      {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : (
        <div className="gestion-cartes" style={{ marginTop: "12px" }}>
          {jours.map((d) => {
            const iso = dateStr(d);
            const duJour = quarts.filter((q) => q.date === iso);
            const titre = d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
            return (
              <div className={`planning-day gestion-jour-horaire${iso === aujourdhui ? " aujourdhui" : ""}`} key={iso}>
                <div className="gestion-jour-horaire-titre">{titre.charAt(0).toUpperCase() + titre.slice(1)}</div>
                {duJour.length === 0 ? (
                  <p className="moi-jour-repos" style={{ margin: 0 }}>
                    Aucun quart
                  </p>
                ) : (
                  duJour.map((q) => (
                    <div className="gestion-quart" key={q.id}>
                      <div className="gestion-quart-heures">
                        {heure(q.heure_debut)} – {heure(q.heure_fin)}
                      </div>
                      <div className="gestion-quart-qui" style={{ flex: 1 }}>
                        <strong>{nomEmploye(q.employe_id)}</strong>
                        {(q.poste || (!emplacementId && emplacements.length > 1 && nomEmplacement(q.emplacement_id))) && (
                          <span className="gestion-quart-detail">
                            {[q.poste, !emplacementId && emplacements.length > 1 ? nomEmplacement(q.emplacement_id) : null].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        {!q.publie && <span className="gestion-brouillon">Brouillon</span>}
                      </div>
                      {edition && (
                        <button type="button" className="admin-icon-btn gestion-crayon" onClick={() => ouvrirModif(q)} aria-label="Modifier ce quart">
                          <IconCrayon className="gozly-icon" />
                        </button>
                      )}
                    </div>
                  ))
                )}
                {edition && (
                  <button type="button" className="gestion-tache-plus" disabled={!peutAjouter} onClick={() => ouvrirAjout(iso)}>
                    + Ajouter à cette journée
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{modal.quartId ? "Modifier le quart" : "Ajouter un quart"}</h3>
              <button className="admin-icon-btn" onClick={() => setModal(null)}>
                Fermer
              </button>
            </div>
            <p className="section-hint" style={{ marginBottom: "12px" }}>
              {new Date(`${modal.date}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
              {modal.emplacementId && emplacements.length > 1 ? ` · ${nomEmplacement(modal.emplacementId)}` : ""}
            </p>
            <form onSubmit={enregistrer}>
              <div className="field">
                <label>Employé</label>
                <ChoixEmploye employes={employesPour(modal.emplacementId)} value={modal.employeId} onChange={(id) => setModal((m) => ({ ...m, employeId: id }))} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Début</label>
                  <input type="time" value={modal.heureDebut} onChange={(e) => setModal((m) => ({ ...m, heureDebut: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>Fin</label>
                  <input type="time" value={modal.heureFin} onChange={(e) => setModal((m) => ({ ...m, heureFin: e.target.value }))} required />
                </div>
              </div>
              <div className="field">
                <label>Poste (optionnel)</label>
                <input type="text" value={modal.poste} onChange={(e) => setModal((m) => ({ ...m, poste: e.target.value }))} placeholder="Ex: Caisse, Cuisine" maxLength={60} />
              </div>
              <div className="admin-edit-actions" style={{ display: "flex", gap: "8px" }}>
                <button type="submit" className="submit-btn" disabled={saving || !modal.employeId}>
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
                {modal.quartId && (
                  <button type="button" className="admin-icon-btn danger" onClick={retirer}>
                    Retirer
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
