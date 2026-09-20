"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashSidebar from "@/components/DashSidebar";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { PERIODES, estConforme, creneauActuel, grouperParJour, relevesEnCsv, telechargerFichier } from "@/lib/temperature";
import EmplacementSelect from "@/components/EmplacementSelect";

export default function TemperatureContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);

  const [emplacements, setEmplacements] = useState([]);
  const [equipements, setEquipements] = useState([]);
  const [relevesDuJour, setRelevesDuJour] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [loadingDonnees, setLoadingDonnees] = useState(true);

  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [emplacementFiltre, setEmplacementFiltre] = useState(null);
  const [jourOuvert, setJourOuvert] = useState(null);

  const creneau = creneauActuel();

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      if (ignore) return;
      setUser(session.user);

      supabase
        .from("admins")
        .select("id")
        .eq("email", session.user.email)
        .maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));

      const { entrepriseId: eid, besoinChoix, invitationsEnAttente } = await resoudreEntrepriseActive(supabase);
      if (ignore) return;

      if (invitationsEnAttente > 0) {
        router.push("/invitations");
        return;
      }
      if (besoinChoix) {
        router.push("/dashboards");
        return;
      }

      setEntrepriseId(eid);
      setChecking(false);
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  useEffect(() => {
    if (!entrepriseId) return;
    load();
  }, [entrepriseId]);

  async function load() {
    setLoadingDonnees(true);
    const [{ data: emps }, { data: eqs }, { data: relevesJour }, hist] = await Promise.all([
      supabase.from("emplacements").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
      supabase
        .from("equipements_temperature")
        .select("*")
        .eq("entreprise_id", entrepriseId)
        .order("nom", { ascending: true }),
      supabase.from("releves_temperature").select("*").eq("entreprise_id", entrepriseId).eq("date_relevee", creneau.date),
      chargerTousLesReleves(),
    ]);
    setEmplacements(emps || []);
    setEquipements(eqs || []);
    setRelevesDuJour(relevesJour || []);
    setHistorique(hist || []);

    const seed = {};
    for (const r of relevesJour || []) {
      if (r.periode === creneau.periode) seed[r.equipement_id] = String(r.temperature);
    }
    setDrafts(seed);
    setLoadingDonnees(false);
  }

  // Supabase plafonne à 1000 lignes par requête - on pagine pour tout récupérer.
  async function chargerTousLesReleves() {
    const tous = [];
    for (let debut = 0; ; debut += 1000) {
      const { data } = await supabase
        .from("releves_temperature")
        .select("*")
        .eq("entreprise_id", entrepriseId)
        .order("date_relevee", { ascending: false })
        .order("id", { ascending: true })
        .range(debut, debut + 999);
      tous.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return tous;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function releveExistant(equipementId, periode) {
    return relevesDuJour.find((r) => r.equipement_id === equipementId && r.periode === periode);
  }

  function estModifie() {
    return equipements.some((eq) => {
      const existant = releveExistant(eq.id, creneau.periode);
      const draftValue = drafts[eq.id] ?? "";
      const existantValue = existant ? String(existant.temperature) : "";
      return draftValue !== existantValue;
    });
  }

  async function handleSaveGrille() {
    setSaving(true);
    setMsg(null);

    const aEnvoyer = equipements.filter((eq) => {
      const existant = releveExistant(eq.id, creneau.periode);
      const draftValue = drafts[eq.id] ?? "";
      const existantValue = existant ? String(existant.temperature) : "";
      return draftValue !== "" && draftValue !== existantValue;
    });

    const displayName = user?.user_metadata?.full_name || user?.email;

    const rows = aEnvoyer.map((eq) => ({
      entreprise_id: entrepriseId,
      equipement_id: eq.id,
      releve_par: displayName,
      temperature: parseFloat(drafts[eq.id]),
      conforme: estConforme(eq.type, parseFloat(drafts[eq.id])),
      date_relevee: creneau.date,
      periode: creneau.periode,
    }));

    const { error } = await supabase
      .from("releves_temperature")
      .upsert(rows, { onConflict: "equipement_id,date_relevee,periode" });

    setSaving(false);

    if (error) {
      setMsg({ type: "err", text: "L'enregistrement a échoué." });
      return;
    }

    setMsg({ type: "ok", text: "Relevés enregistrés !" });
    setTimeout(() => setMsg(null), 3000);
    load();
  }

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.entreprise || user?.email;
  const periodeLabel = PERIODES.find((p) => p.id === creneau.periode)?.label || "";
  const grilleAmPm = { display: "grid", gridTemplateColumns: "1fr 100px 100px", gap: "10px", alignItems: "center", marginBottom: "8px", maxWidth: "560px" };

  const equipementsFiltres = emplacementFiltre ? equipements.filter((eq) => eq.emplacement_id === emplacementFiltre) : equipements;

  const historiqueFiltre = emplacementFiltre
    ? historique.filter((r) => equipements.find((eq) => eq.id === r.equipement_id)?.emplacement_id === emplacementFiltre)
    : historique;

  const fiches = grouperParJour(historiqueFiltre);

  function exporter(releves, nomFichier) {
    telechargerFichier(nomFichier, relevesEnCsv(releves, equipements, emplacements));
  }

  return (
    <div className="dash-layout">
      <DashSidebar
        active="temperature"
        displayName={displayName}
        userEmail={user?.email}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        entrepriseId={entrepriseId}
      />

      <main className="dash-main">
        <div className="dash-main-inner">
          <header
            className="dash-hero-inline"
            style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}
          >
            <div>
              <h1>Températures</h1>
              <p>Registre de conformité MAPAQ - frigos, congélateurs et maintien au chaud.</p>
            </div>
            <Link href="/dashboard/temperature/equipements" className="admin-icon-btn">
              ⚙ Gérer les équipements
            </Link>
          </header>

          {!entrepriseId ? (
            <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
          ) : loadingDonnees ? (
            <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
          ) : (
            <>
              <div style={{ marginBottom: "14px" }}>
                <EmplacementSelect emplacements={emplacements} value={emplacementFiltre} onChange={setEmplacementFiltre} includeToutes />
              </div>

              <div className="settings-section">
                <h3>Créneau actuel : {periodeLabel}</h3>
                <p className="section-hint">
                  Une fenêtre manquée ne revient pas - inutile de rattraper un relevé oublié, on passe simplement au prochain créneau.
                </p>

                {equipementsFiltres.length === 0 ? (
                  <p className="section-hint">
                    Aucun équipement pour l'instant -{" "}
                    <Link href="/dashboard/temperature/equipements" style={{ color: "var(--text)" }}>
                      ajoutes-en un
                    </Link>{" "}
                    pour commencer.
                  </p>
                ) : (
                  <>
                    <div style={{ ...grilleAmPm, fontSize: "12px", fontWeight: 700, color: "var(--text-dim)" }}>
                      <div>Équipement</div>
                      {["am", "pm"].map((p) => (
                        <div key={p} style={{ textAlign: "center", color: p === creneau.periode ? "var(--text)" : undefined }}>
                          {p.toUpperCase()}
                          {p === creneau.periode ? " ●" : ""}
                        </div>
                      ))}
                    </div>
                    {equipementsFiltres.map((eq) => {
                      const actuel = releveExistant(eq.id, creneau.periode);
                      return (
                        <div key={eq.id} style={grilleAmPm}>
                          <div style={{ fontSize: "13.5px", fontWeight: 600, minWidth: 0 }}>
                            {eq.nom}
                            {actuel && <div style={{ fontSize: "11px", fontWeight: 400, color: "var(--text-dim)" }}>par {actuel.releve_par}</div>}
                          </div>
                          {["am", "pm"].map((p) => {
                            if (p === creneau.periode) {
                              return (
                                <input
                                  key={p}
                                  type="number"
                                  step="0.1"
                                  placeholder="°C"
                                  style={{ width: "100%", boxSizing: "border-box" }}
                                  value={drafts[eq.id] ?? ""}
                                  onChange={(e) => setDrafts((prev) => ({ ...prev, [eq.id]: e.target.value }))}
                                />
                              );
                            }
                            const r = releveExistant(eq.id, p);
                            return (
                              <div key={p} style={{ textAlign: "center", fontSize: "13px", color: r ? "var(--text)" : "var(--text-dim)" }}>
                                {r ? `${r.conforme ? "✓" : "⚠️"} ${r.temperature}°C` : "—"}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    <button type="button" className="submit-btn" onClick={handleSaveGrille} disabled={saving || !estModifie()}>
                      {saving ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
                  </>
                )}
              </div>

              <div className="settings-divider">Historique</div>

              {fiches.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                  <button
                    type="button"
                    className="admin-icon-btn"
                    onClick={() => exporter(historiqueFiltre, `temperatures_${creneau.date}.csv`)}
                  >
                    ⬇ Tout exporter (Excel)
                  </button>
                  <span className="section-hint" style={{ margin: 0 }}>
                    Les fiches sont supprimées automatiquement après la durée choisie dans Personnalisation - exporte-les pour les garder.
                  </span>
                </div>
              )}

              {fiches.length === 0 ? (
                <p style={{ color: "var(--text-dim)" }}>Aucune fiche pour l'instant.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxWidth: "720px" }}>
                  {fiches.map((f) => {
                    const ouvert = jourOuvert === f.date;
                    const enCours = f.date === creneau.date;
                    const equipementsDuJour = equipements.filter((eq) => f.releves.some((r) => r.equipement_id === eq.id));
                    return (
                      <div key={f.date} className="planning-day">
                        <button
                          type="button"
                          onClick={() => setJourOuvert(ouvert ? null : f.date)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                            padding: "12px 14px", background: "none", border: "none", color: "inherit", cursor: "pointer", font: "inherit", textAlign: "left",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            {new Date(f.date + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                            {enCours && <span style={{ color: "var(--text-dim)", fontWeight: 400 }}> · en cours</span>}
                          </span>
                          <span style={{ fontSize: "12.5px", color: "var(--text-dim)" }}>
                            {f.nonConformes > 0 ? `⚠️ ${f.nonConformes} non conforme${f.nonConformes > 1 ? "s" : ""}` : "✓ conforme"} {ouvert ? "▴" : "▾"}
                          </span>
                        </button>
                        {ouvert && (
                          <div style={{ padding: "0 14px 12px" }}>
                            <div style={{ ...grilleAmPm, gridTemplateColumns: "1fr 120px 120px", maxWidth: "none", fontSize: "12px", fontWeight: 700, color: "var(--text-dim)" }}>
                              <div>Équipement</div>
                              <div style={{ textAlign: "center" }}>AM</div>
                              <div style={{ textAlign: "center" }}>PM</div>
                            </div>
                            {equipementsDuJour.map((eq) => (
                              <div key={eq.id} style={{ ...grilleAmPm, gridTemplateColumns: "1fr 120px 120px", maxWidth: "none" }}>
                                <div style={{ fontSize: "13.5px", fontWeight: 600 }}>{eq.nom}</div>
                                {["am", "pm"].map((p) => {
                                  const r = f.releves.find((x) => x.equipement_id === eq.id && x.periode === p);
                                  return (
                                    <div key={p} style={{ textAlign: "center", fontSize: "13px", color: r ? "var(--text)" : "var(--text-dim)" }}>
                                      {r ? `${r.conforme ? "✓" : "⚠️"} ${r.temperature}°C` : "—"}
                                      {r && <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>{r.releve_par}</div>}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                            <button type="button" className="admin-icon-btn" onClick={() => exporter(f.releves, `temperatures_${f.date}.csv`)}>
                              ⬇ Exporter cette fiche
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
