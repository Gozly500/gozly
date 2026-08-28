"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashSidebar from "@/components/DashSidebar";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { PERIODES, estConforme, creneauActuel } from "@/lib/temperature";
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
    const [{ data: emps }, { data: eqs }, { data: relevesJour }, { data: hist }] = await Promise.all([
      supabase.from("emplacements").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
      supabase
        .from("equipements_temperature")
        .select("*, categorie:categorie_id(id, nom)")
        .eq("entreprise_id", entrepriseId)
        .order("nom", { ascending: true }),
      supabase.from("releves_temperature").select("*").eq("entreprise_id", entrepriseId).eq("date_relevee", creneau.date),
      supabase
        .from("releves_temperature")
        .select("*, equipement:equipement_id(nom)")
        .eq("entreprise_id", entrepriseId)
        .order("date_relevee", { ascending: false })
        .order("periode", { ascending: true })
        .limit(100),
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
  const autrePeriode = creneau.periode === "am" ? "pm" : "am";

  const equipementsFiltres = emplacementFiltre ? equipements.filter((eq) => eq.emplacement_id === emplacementFiltre) : equipements;

  const categoriesAffichees = [];
  const parCategorie = new Map();
  for (const eq of equipementsFiltres) {
    const cle = eq.categorie?.id || "sans-categorie";
    if (!parCategorie.has(cle)) {
      parCategorie.set(cle, []);
      categoriesAffichees.push({ id: cle, nom: eq.categorie?.nom || "Sans catégorie" });
    }
    parCategorie.get(cle).push(eq);
  }

  const historiqueFiltre = emplacementFiltre
    ? historique.filter((r) => equipements.find((eq) => eq.id === r.equipement_id)?.emplacement_id === emplacementFiltre)
    : historique;

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
                    {categoriesAffichees.map((cat) => (
                      <div key={cat.id} style={{ marginBottom: "16px" }}>
                        <h4 style={{ fontSize: "12.5px", color: "var(--text-dim)", marginBottom: "8px" }}>{cat.nom}</h4>
                        {parCategorie.get(cat.id).map((eq) => {
                          const autreReleve = releveExistant(eq.id, autrePeriode);
                          return (
                            <div key={eq.id} className="field-row" style={{ alignItems: "center", marginBottom: "6px" }}>
                              <div style={{ flex: 1, fontSize: "13.5px", fontWeight: 600 }}>{eq.nom}</div>
                              <div style={{ fontSize: "12.5px", color: "var(--text-dim)", minWidth: "110px" }}>
                                {autrePeriode === "am" ? "AM" : "PM"}:{" "}
                                {autreReleve ? `${autreReleve.conforme ? "✓" : "⚠️"} ${autreReleve.temperature}°C` : "—"}
                              </div>
                              <input
                                type="number"
                                step="0.1"
                                placeholder="°C"
                                style={{ width: "90px" }}
                                value={drafts[eq.id] ?? ""}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [eq.id]: e.target.value }))}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}

                    <button type="button" className="submit-btn" onClick={handleSaveGrille} disabled={saving || !estModifie()}>
                      {saving ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    {msg && <p className={`settings-msg ${msg.type}`}>{msg.text}</p>}
                  </>
                )}
              </div>

              <div className="settings-divider">Historique</div>

              {historiqueFiltre.length === 0 ? (
                <p style={{ color: "var(--text-dim)" }}>Aucun relevé pour l'instant.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Créneau</th>
                        <th>Équipement</th>
                        <th>Température</th>
                        <th>Relevé par</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historiqueFiltre.map((r) => (
                        <tr key={r.id}>
                          <td>{new Date(r.date_relevee + "T00:00:00").toLocaleDateString("fr-CA")}</td>
                          <td>{PERIODES.find((p) => p.id === r.periode)?.label}</td>
                          <td>{r.equipement?.nom || "?"}</td>
                          <td>
                            {r.conforme ? "✓" : "⚠️"} {r.temperature}°C
                          </td>
                          <td>{r.releve_par}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
