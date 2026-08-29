"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import EmplacementSelect from "@/components/EmplacementSelect";
import { SERVICES_PAIE } from "@/lib/servicesPaie";
import { getDebutSemaine, addDays } from "@/lib/semaine";
import { IconIntegration } from "@/components/icons/GozlyIcons";
import { PERMISSIONS } from "@/lib/permissions";

function heuresDecimal(minutes) {
  return (minutes / 60).toFixed(2);
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// <input type="datetime-local"> veut "AAAA-MM-JJTHH:MM" en heure locale.
function toDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Combine une date ("AAAA-MM-JJ") et une heure ("HH:MM:SS") de planning_quarts
// en Date locale, pour la comparer à l'heure réelle de pointage.
function combineDateHeure(date, heure) {
  const [h, m] = heure.split(":").map(Number);
  const d = new Date(`${date}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

export default function FeuilleTempsSection({ entrepriseId }) {
  const [weekStart, setWeekStart] = useState(() => getDebutSemaine(new Date()));
  const [employes, setEmployes] = useState([]);
  const [pointages, setPointages] = useState([]);
  const [quarts, setQuarts] = useState([]);
  const [calculPointage, setCalculPointage] = useState("reel");
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementId] = useState(null); // null = toutes
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { pointageId, employeNom, entree, sortie }
  const [saving, setSaving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [nethrisConnecte, setNethrisConnecte] = useState(false);
  const [mesPermissions, setMesPermissions] = useState([]);
  const [autoVisible, setAutoVisible] = useState(false);
  const [semainesApprouvees, setSemainesApprouvees] = useState([]);
  const [approving, setApproving] = useState(false);

  const weekEnd = addDays(weekStart, 7);
  const peutCorriger = mesPermissions.includes("corriger_feuille_temps");
  const peutApprouver = mesPermissions.includes("approuver_feuille_temps");
  const peutExporter = mesPermissions.includes("exporter_feuille_temps");
  const seulementVoir = mesPermissions.includes("voir_feuille_temps") && !peutCorriger && !peutApprouver;

  useEffect(() => {
    supabase
      .from("emplacements")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setEmplacements(data || []));
  }, [entrepriseId]);

  useEffect(() => {
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: membre } = await supabase
        .from("membres")
        .select("id, role")
        .eq("entreprise_id", entrepriseId)
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!membre) return;
      if (membre.role === "proprietaire") {
        setMesPermissions(PERMISSIONS.map((p) => p.id));
        return;
      }
      const { data: perms } = await supabase.from("membre_permissions").select("permission").eq("membre_id", membre.id);
      setMesPermissions((perms || []).map((p) => p.permission));
    });
  }, [entrepriseId]);

  useEffect(() => {
    loadApprobations();
  }, [entrepriseId, weekStart]);

  async function loadApprobations() {
    const { data } = await supabase
      .from("feuille_temps_semaines")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .eq("semaine_debut", dateStr(weekStart));
    setSemainesApprouvees(data || []);
  }

  async function handleApprouverSemaine(targetEmplacementId) {
    setApproving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await supabase.from("feuille_temps_semaines").insert({
      entreprise_id: entrepriseId,
      emplacement_id: targetEmplacementId,
      semaine_debut: dateStr(weekStart),
      approuve_par: session?.user?.id,
    });
    await loadApprobations();
    setApproving(false);
  }

  async function handleDesapprouverSemaine(row) {
    setApproving(true);
    await supabase.from("feuille_temps_semaines").delete().eq("id", row.id);
    await loadApprobations();
    setApproving(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      try {
        const res = await fetch("/api/paie/nethris/statut", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        setNethrisConnecte(!!data.connecte);
      } catch {
        setNethrisConnecte(false);
      }
    });
  }, []);

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

    setEmployes(employesData || []);
    setPointages(pointagesData || []);
    setQuarts(quartsData || []);
    setLoading(false);
  }

  // En mode "horaire", si l'employé pointe avant l'heure prévue à son quart,
  // le calcul des heures part de l'heure prévue plutôt que de l'heure réelle
  // de pointage. S'il pointe en retard (ou qu'aucun quart n'est planifié ce
  // jour-là pour lui), l'heure réelle de pointage est toujours utilisée.
  function debutEffectif(pointage) {
    const entree = new Date(pointage.entree);
    if (calculPointage !== "horaire") return entree;

    const quart = quarts.find(
      (q) => q.employe_id === pointage.employe_id && q.date === dateStr(entree)
    );
    if (!quart) return entree;

    const prevu = combineDateHeure(quart.date, quart.heure_debut);
    return entree < prevu ? prevu : entree;
  }

  function sessionsPour(employeId) {
    return pointages
      .filter((p) => p.employe_id === employeId)
      .map((p) => {
        // "debut" reste l'heure réelle de pointage (affichage, édition) -
        // seul le calcul des minutes tient compte de l'heure prévue à
        // l'horaire quand le mode "horaire" est actif.
        const fin = p.sortie ? new Date(p.sortie) : new Date();
        const debutCalcul = debutEffectif(p);
        return { pointageId: p.id, debut: p.entree, fin: p.sortie, minutes: (fin - debutCalcul) / 60000 };
      });
  }

  const lignes = employes.flatMap((emp) =>
    sessionsPour(emp.id).map((s) => ({ employe: emp.nom, ...s }))
  );

  function openEdit(ligne) {
    setModal({
      pointageId: ligne.pointageId,
      employeNom: ligne.employe,
      entree: toDatetimeLocal(ligne.debut),
      sortie: toDatetimeLocal(ligne.fin),
    });
  }

  async function handleSaveModal(e) {
    e.preventDefault();
    setSaving(true);

    await supabase
      .from("pointages")
      .update({
        entree: new Date(modal.entree).toISOString(),
        sortie: modal.sortie ? new Date(modal.sortie).toISOString() : null,
      })
      .eq("id", modal.pointageId);

    setSaving(false);
    setModal(null);
    load();
  }

  // Nethris importe les heures par semaine, par employé, réparties sur des
  // codes de gain (1 = heures régulières, 43 = heures supplémentaires par
  // défaut - à ajuster si ton entreprise utilise d'autres codes dans Nethris).
  function handleExportNethris() {
    setExportOpen(false);

    const totauxParEmploye = employes.map((emp) => {
      const minutes = sessionsPour(emp.id).reduce((sum, s) => sum + s.minutes, 0);
      return { employe: emp, heures: minutes / 60 };
    }).filter((t) => t.heures > 0);

    const semaineDu = weekStart.toLocaleDateString("fr-CA");
    const header = [
      "Numero d'employe",
      "Nom de l'employe",
      "Semaine du",
      "Code 1 - Heures regulieres",
      "Code 43 - Heures supplementaires",
    ];
    const rows = totauxParEmploye.map(({ employe, heures }) => {
      const regulieres = Math.min(heures, 40);
      const supplementaires = Math.max(0, heures - 40);
      return [
        employe.numero_paie || "",
        employe.nom,
        semaineDu,
        regulieres.toFixed(2),
        supplementaires.toFixed(2),
      ];
    });

    downloadCsv(`nethris-heures-${weekStart.toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  }

  const weekLabel = `${weekStart.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} - ${addDays(
    weekStart,
    6
  ).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}`;

  const approbationActuelle = semainesApprouvees.find((s) => s.emplacement_id === emplacementId);

  return (
    <div>
      <EmplacementSelect emplacements={emplacements} value={emplacementId} onChange={setEmplacementId} includeToutes />

      <div className="planning-week-nav">
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))}>
          ‹ Semaine précédente
        </button>
        <span className="planning-week-label">{weekLabel}</span>
        <button className="admin-icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))}>
          Semaine suivante ›
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
        {autoVisible && (
          <span className="section-hint" style={{ margin: 0 }}>
            Mode automatique actif (Personnalisation) - visible sans approbation.
          </span>
        )}

        {peutApprouver &&
          (emplacements.length > 1 && !emplacementId ? (
            <span className="section-hint" style={{ margin: 0 }}>Choisis une succursale pour approuver.</span>
          ) : approbationActuelle ? (
            <button className="admin-icon-btn" onClick={() => handleDesapprouverSemaine(approbationActuelle)} disabled={approving}>
              Retirer l'approbation
            </button>
          ) : (
            <button className="btn-small" onClick={() => handleApprouverSemaine(emplacementId)} disabled={approving}>
              Approuver cette semaine
            </button>
          ))}

        {peutExporter && (
          <div className="account-wrap">
            <button
              className="submit-btn"
              onClick={() => setExportOpen((v) => !v)}
              disabled={lignes.length === 0}
            >
              ⬇ Exporter ▾
            </button>
            {exportOpen && (
              <div className="account-dropdown open">
                {SERVICES_PAIE.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="menu-item"
                    disabled={!s.disponible}
                    onClick={s.id === "nethris" ? handleExportNethris : undefined}
                  >
                    {s.label}
                    {!s.disponible && " (bientôt disponible)"}
                    {s.id === "nethris" && s.disponible && nethrisConnecte && <IconIntegration className="gozly-icon" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      ) : lignes.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>
          {seulementVoir && !autoVisible
            ? "Rien à afficher : cette semaine n'a pas encore été approuvée, ou il n'y a aucun pointage."
            : "Aucun pointage cette semaine."}
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Date</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Heures</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={i}>
                  <td>{l.employe}</td>
                  <td>{new Date(l.debut).toLocaleDateString("fr-CA")}</td>
                  <td>{new Date(l.debut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>{l.fin ? new Date(l.fin).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "en cours"}</td>
                  <td>{heuresDecimal(l.minutes)}</td>
                  <td>
                    {peutCorriger && (
                      <button className="admin-icon-btn" onClick={() => openEdit(l)}>
                        Modifier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="section-hint" style={{ marginTop: "14px" }}>
        L'export Nethris contient une ligne par employé pour la semaine affichée (heures régulières et
        supplémentaires séparées, au-delà de 40h/semaine). Renseigne le numéro d'employé de chacun dans
        Entreprise → Employés pour qu'il corresponde à sa fiche dans Nethris, et vérifie que les codes de
        gain (1 et 43 par défaut) correspondent à ta configuration Nethris avant l'importation.
      </p>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-card" style={{ maxWidth: "360px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Corriger le pointage</h3>
              <button className="admin-icon-btn" onClick={() => setModal(null)}>
                Fermer
              </button>
            </div>
            <p className="section-hint" style={{ marginBottom: "14px" }}>{modal.employeNom}</p>
            <form onSubmit={handleSaveModal}>
              <div className="field">
                <label>Arrivée</label>
                <input
                  type="datetime-local"
                  value={modal.entree}
                  onChange={(e) => setModal((m) => ({ ...m, entree: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label>Départ (laisser vide si toujours en cours)</label>
                <input
                  type="datetime-local"
                  value={modal.sortie}
                  onChange={(e) => setModal((m) => ({ ...m, sortie: e.target.value }))}
                />
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
