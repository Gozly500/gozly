"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EmplacementSelect from "@/components/EmplacementSelect";
import { getDebutSemaine, addDays } from "@/lib/semaine";
import { useGestion } from "@/components/gestion/GestionShell";

function dateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function combineDateHeure(date, heure) {
  const [h, m] = heure.split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

function heureCourte(iso) {
  return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

function heures(minutes) {
  return `${(minutes / 60).toFixed(2)} h`;
}

// <input type="datetime-local"> veut "AAAA-MM-JJTHH:MM" en heure locale.
function versDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Feuille de temps pour le téléphone : une carte par employé (total de la semaine),
// qu'on ouvre pour voir ses 7 jours, plus l'approbation de la semaine.
// Mêmes données et mêmes règles de calcul que la feuille de temps du dashboard.
export default function FeuilleTempsMobile() {
  const { entrepriseId, a, user } = useGestion();
  const peutApprouver = a("approuver_feuille_temps");
  const peutCorriger = a("corriger_feuille_temps");
  const seulementVoir = a("voir_feuille_temps") && !peutCorriger && !peutApprouver;

  const [weekStart, setWeekStart] = useState(() => getDebutSemaine(new Date()));
  const [employes, setEmployes] = useState([]);
  const [assignes, setAssignes] = useState(null);
  const [pointages, setPointages] = useState([]);
  const [quarts, setQuarts] = useState([]);
  const [calculPointage, setCalculPointage] = useState("reel");
  const [autoVisible, setAutoVisible] = useState(false);
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementId] = useState(null);
  const [semainesApprouvees, setSemainesApprouvees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [ouvertId, setOuvertId] = useState(null);
  const [modal, setModal] = useState(null); // { pointageId, employeNom, entree, sortie }
  const [saving, setSaving] = useState(false);

  const weekEnd = addDays(weekStart, 7);

  useEffect(() => {
    supabase
      .from("emplacements")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setEmplacements(data || []));

    supabase
      .from("entreprises")
      .select("premier_jour_semaine, pointage_calcul_mode, feuille_temps_visible_sans_approbation")
      .eq("id", entrepriseId)
      .maybeSingle()
      .then(({ data }) => {
        const dimanche = data?.premier_jour_semaine === "dimanche";
        setWeekStart((w) => getDebutSemaine(addDays(w, 3), dimanche));
        setCalculPointage(data?.pointage_calcul_mode || "reel");
        setAutoVisible(!!data?.feuille_temps_visible_sans_approbation);
      });
  }, [entrepriseId]);

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrepriseId, weekStart, emplacementId]);

  async function chargerApprobations() {
    const { data } = await supabase
      .from("feuille_temps_semaines")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .eq("semaine_debut", dateStr(weekStart));
    setSemainesApprouvees(data || []);
  }

  async function charger() {
    setLoading(true);

    // Ferme d'abord les pointages oubliés (voir Entreprise > Emplacements > Horaires).
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      await fetch("/api/pointage/fermer-oublies", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData?.session?.access_token}` },
        body: JSON.stringify({ entrepriseId }),
      });
    } catch {}

    const { data: employesData } = await supabase
      .from("employes")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("nom", { ascending: true });

    let pointagesQuery = supabase
      .from("pointages")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("entree", weekStart.toISOString())
      .lt("entree", weekEnd.toISOString())
      .order("entree", { ascending: true });
    if (emplacementId) pointagesQuery = pointagesQuery.eq("emplacement_id", emplacementId);
    const { data: pointagesData } = await pointagesQuery;

    const { data: quartsData } = await supabase
      .from("planning_quarts")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .gte("date", dateStr(weekStart))
      .lt("date", dateStr(weekEnd));

    if (emplacementId) {
      const { data: liens } = await supabase.from("employe_emplacements").select("employe_id").eq("emplacement_id", emplacementId);
      setAssignes(new Set((liens || []).map((l) => l.employe_id)));
    } else {
      setAssignes(null);
    }

    setEmployes(employesData || []);
    setPointages(pointagesData || []);
    setQuarts(quartsData || []);
    await chargerApprobations();
    setLoading(false);
  }

  // Mode "horaire" : arriver avant l'heure prévue ne compte que depuis l'heure prévue.
  function debutEffectif(pointage) {
    const entree = new Date(pointage.entree);
    if (calculPointage !== "horaire") return entree;
    const quart = quarts.find((q) => q.employe_id === pointage.employe_id && q.date === dateStr(entree));
    if (!quart) return entree;
    const prevu = combineDateHeure(quart.date, quart.heure_debut);
    return entree < prevu ? prevu : entree;
  }

  function sessionsPour(employeId) {
    return pointages
      .filter((p) => p.employe_id === employeId)
      .map((p) => {
        const fin = p.sortie ? new Date(p.sortie) : new Date();
        return { pointageId: p.id, debut: p.entree, fin: p.sortie, auto: !!p.sortie_auto, minutes: (fin - debutEffectif(p)) / 60000 };
      });
  }

  const jours = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const employesAffiches = employes.filter((emp) => assignes === null || assignes.has(emp.id) || sessionsPour(emp.id).length > 0);
  const totalGeneral = employesAffiches.reduce((somme, emp) => somme + sessionsPour(emp.id).reduce((s, x) => s + x.minutes, 0), 0);
  const aDesPointages = pointages.length > 0;

  const approbationActuelle = semainesApprouvees.find((s) => s.emplacement_id === emplacementId);
  const doitChoisirSuccursale = emplacements.length > 1 && !emplacementId;

  async function approuver() {
    setApproving(true);
    await supabase.from("feuille_temps_semaines").insert({
      entreprise_id: entrepriseId,
      emplacement_id: emplacementId,
      semaine_debut: dateStr(weekStart),
      approuve_par: user?.id,
    });
    await chargerApprobations();
    setApproving(false);
  }

  async function desapprouver(row) {
    setApproving(true);
    await supabase.from("feuille_temps_semaines").delete().eq("id", row.id);
    await chargerApprobations();
    setApproving(false);
  }

  function ouvrirCorrection(x, employeNom) {
    if (!peutCorriger) return;
    setModal({ pointageId: x.pointageId, employeNom, entree: versDatetimeLocal(x.debut), sortie: versDatetimeLocal(x.fin) });
  }

  async function enregistrerCorrection(e) {
    e.preventDefault();
    setSaving(true);
    await supabase
      .from("pointages")
      .update({
        entree: new Date(modal.entree).toISOString(),
        sortie: modal.sortie ? new Date(modal.sortie).toISOString() : null,
        sortie_auto: false, // corrigé à la main : plus un « oubli potentiel »
      })
      .eq("id", modal.pointageId);
    setSaving(false);
    setModal(null);
    charger();
  }

  const libelleSemaine = `${weekStart.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} - ${addDays(weekStart, 6).toLocaleDateString(
    "fr-CA",
    { day: "numeric", month: "long" }
  )}`;

  function libelleJour(d) {
    const nom = d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
    return nom.charAt(0).toUpperCase() + nom.slice(1);
  }

  function Pointage({ x, nom }) {
    const contenu = (
      <>
        {heureCourte(x.debut)} – {x.fin ? heureCourte(x.fin) : <em style={{ color: "#ffd479" }}>en cours</em>}
        {x.auto && <span className="gestion-oubli">⚠ oubli potentiel</span>}
      </>
    );
    return peutCorriger ? (
      <button type="button" className="gestion-pointage corrigeable" onClick={() => ouvrirCorrection(x, nom)}>
        {contenu}
      </button>
    ) : (
      <div className="gestion-pointage">{contenu}</div>
    );
  }

  return (
    <div>
      <div className="moi-week-nav">
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          ‹
        </button>
        <span className="moi-week-label">{libelleSemaine}</span>
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          ›
        </button>
      </div>

      <EmplacementSelect emplacements={emplacements} value={emplacementId} onChange={setEmplacementId} includeToutes />

      <div className="gestion-approbation">
        {approbationActuelle ? (
          <>
            <span className="gestion-approuvee">✓ Semaine approuvée</span>
            {peutApprouver && (
              <button className="admin-icon-btn" onClick={() => desapprouver(approbationActuelle)} disabled={approving}>
                Retirer
              </button>
            )}
          </>
        ) : peutApprouver ? (
          doitChoisirSuccursale ? (
            <span className="section-hint" style={{ margin: 0 }}>
              Choisis une succursale pour approuver la semaine.
            </span>
          ) : (
            <button className="btn-small" onClick={approuver} disabled={approving}>
              Approuver cette semaine
            </button>
          )
        ) : (
          <span className="section-hint" style={{ margin: 0 }}>
            Semaine pas encore approuvée.
          </span>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : !aDesPointages && seulementVoir && !autoVisible ? (
        <p className="chat-empty">Rien à afficher : cette semaine n'a pas encore été approuvée, ou il n'y a aucun pointage.</p>
      ) : employesAffiches.length === 0 ? (
        <p className="chat-empty">Aucun employé à afficher.</p>
      ) : (
        <>
          <div className="gestion-resume">
            <span>
              Total de la semaine : <strong>{heures(totalGeneral)}</strong>
            </span>
          </div>

          <div className="gestion-cartes">
              {employesAffiches.map((emp) => {
                const sessions = sessionsPour(emp.id);
                const total = sessions.reduce((s, x) => s + x.minutes, 0);
                const nbOublis = sessions.filter((x) => x.auto).length;
                const ouvert = ouvertId === emp.id;
                return (
                  <div className="planning-day gestion-carte" key={emp.id}>
                    <button type="button" className="gestion-carte-tete" onClick={() => setOuvertId(ouvert ? null : emp.id)} aria-expanded={ouvert}>
                      <span className="gestion-carte-nom">
                        {emp.nom}
                        {nbOublis > 0 && <span className="gestion-oubli">⚠ {nbOublis}</span>}
                      </span>
                      <span className="gestion-carte-total">{total > 0 ? heures(total) : "—"}</span>
                      <span className="gestion-chevron">{ouvert ? "▾" : "▸"}</span>
                    </button>
                    {ouvert && (
                      <div className="gestion-jours">
                        {jours.map((d) => {
                          const duJour = sessions.filter((x) => dateStr(new Date(x.debut)) === dateStr(d));
                          return (
                            <div className="gestion-jour" key={dateStr(d)}>
                              <div className="gestion-jour-nom">{libelleJour(d)}</div>
                              <div className="gestion-jour-valeurs">
                                {duJour.length === 0 ? (
                                  <span style={{ color: "var(--text-dim)" }}>—</span>
                                ) : (
                                  duJour.map((x) => <Pointage key={x.pointageId} x={x} nom={emp.nom} />)
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Corriger le pointage</h3>
              <button className="admin-icon-btn" onClick={() => setModal(null)}>
                Fermer
              </button>
            </div>
            <p className="section-hint" style={{ marginBottom: "14px" }}>
              {modal.employeNom}
            </p>
            <form onSubmit={enregistrerCorrection}>
              <div className="field">
                <label>Arrivée</label>
                <input type="datetime-local" value={modal.entree} onChange={(e) => setModal((m) => ({ ...m, entree: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Départ (laisser vide si toujours en cours)</label>
                <input type="datetime-local" value={modal.sortie} onChange={(e) => setModal((m) => ({ ...m, sortie: e.target.value }))} />
              </div>
              <div className="admin-edit-actions">
                <button type="submit" className="submit-btn" disabled={saving}>
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
