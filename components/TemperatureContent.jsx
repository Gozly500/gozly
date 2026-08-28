"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashSidebar from "@/components/DashSidebar";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { TYPES_EQUIPEMENT, estConforme } from "@/lib/temperature";
import EmplacementSelect from "@/components/EmplacementSelect";
import SimpleSelect from "@/components/SimpleSelect";

export default function TemperatureContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);

  const [emplacements, setEmplacements] = useState([]);
  const [equipements, setEquipements] = useState([]);
  const [releves, setReleves] = useState([]);
  const [loadingDonnees, setLoadingDonnees] = useState(true);

  const [emplacementFiltre, setEmplacementFiltre] = useState(null);

  const [nomEquipement, setNomEquipement] = useState("");
  const [typeEquipement, setTypeEquipement] = useState("refrigerateur");
  const [emplacementEquipement, setEmplacementEquipement] = useState(null);
  const [gestionOuverte, setGestionOuverte] = useState(false);

  const [equipementReleve, setEquipementReleve] = useState("");
  const [temperatureReleve, setTemperatureReleve] = useState("");
  const [noteReleve, setNoteReleve] = useState("");
  const [saving, setSaving] = useState(false);

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
    const [{ data: emps }, { data: eqs }, { data: rels }] = await Promise.all([
      supabase.from("emplacements").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
      supabase.from("equipements_temperature").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
      supabase
        .from("releves_temperature")
        .select("*, equipement:equipement_id(nom, type, emplacement_id)")
        .eq("entreprise_id", entrepriseId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setEmplacements(emps || []);
    setEquipements(eqs || []);
    setReleves(rels || []);
    setLoadingDonnees(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleAddEquipement(e) {
    e.preventDefault();
    if (!nomEquipement.trim()) return;
    await supabase.from("equipements_temperature").insert({
      entreprise_id: entrepriseId,
      nom: nomEquipement.trim(),
      type: typeEquipement,
      emplacement_id: emplacementEquipement,
    });
    setNomEquipement("");
    setTypeEquipement("refrigerateur");
    setEmplacementEquipement(null);
    load();
  }

  async function handleDeleteEquipement(id) {
    await supabase.from("equipements_temperature").delete().eq("id", id);
    load();
  }

  async function handleAddReleve(e) {
    e.preventDefault();
    if (!equipementReleve || temperatureReleve === "") return;

    const equipement = equipements.find((eq) => eq.id === equipementReleve);
    const temp = parseFloat(temperatureReleve);
    const conforme = estConforme(equipement?.type, temp);
    const displayName = user?.user_metadata?.full_name || user?.email;

    setSaving(true);
    await supabase.from("releves_temperature").insert({
      entreprise_id: entrepriseId,
      equipement_id: equipementReleve,
      releve_par: displayName,
      temperature: temp,
      conforme,
      note: noteReleve.trim() || null,
    });
    setSaving(false);
    setTemperatureReleve("");
    setNoteReleve("");
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

  const relevesFiltres = emplacementFiltre
    ? releves.filter((r) => r.equipement?.emplacement_id === emplacementFiltre)
    : releves;

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
          <header className="dash-hero-inline">
            <div>
              <h1>Températures</h1>
              <p>Registre de conformité MAPAQ - frigos, congélateurs et maintien au chaud.</p>
            </div>
          </header>

          {!entrepriseId ? (
            <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
          ) : loadingDonnees ? (
            <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
          ) : (
            <>
              <div className="settings-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3>Équipements</h3>
                    <p className="section-hint">Les frigos, congélateurs et postes que tu veux surveiller.</p>
                  </div>
                  <button type="button" className="admin-icon-btn" onClick={() => setGestionOuverte((v) => !v)}>
                    Gérer {gestionOuverte ? "▴" : "▾"}
                  </button>
                </div>

                {gestionOuverte && (
                  <>
                    <div className="admin-list" style={{ marginTop: "14px", marginBottom: "14px", maxWidth: "560px" }}>
                      {equipements.map((eq) => (
                        <div className="admin-row" key={eq.id}>
                          <div className="admin-row-main">
                            <div className="admin-row-title">{eq.nom}</div>
                            <div className="admin-row-sub">
                              {TYPES_EQUIPEMENT.find((t) => t.id === eq.type)?.label}
                              {eq.emplacement_id && " · " + (emplacements.find((e) => e.id === eq.emplacement_id)?.nom || "")}
                            </div>
                          </div>
                          <div className="admin-row-controls">
                            <button className="admin-icon-btn danger" onClick={() => handleDeleteEquipement(eq.id)}>
                              Retirer
                            </button>
                          </div>
                        </div>
                      ))}
                      {equipements.length === 0 && <div className="admin-empty">Aucun équipement pour l'instant.</div>}
                    </div>

                    <form className="field-row" onSubmit={handleAddEquipement} style={{ alignItems: "flex-end" }}>
                      <div className="field">
                        <label>Nom</label>
                        <input
                          type="text"
                          placeholder="Frigo cuisine"
                          value={nomEquipement}
                          onChange={(e) => setNomEquipement(e.target.value)}
                          required
                        />
                      </div>
                      <div className="field" style={{ minWidth: "200px" }}>
                        <label>Type</label>
                        <SimpleSelect
                          options={TYPES_EQUIPEMENT.map((t) => ({ id: t.id, label: t.label }))}
                          value={typeEquipement}
                          onChange={setTypeEquipement}
                        />
                      </div>
                      {emplacements.length > 1 && (
                        <div className="field">
                          <label>Succursale</label>
                          <EmplacementSelect emplacements={emplacements} value={emplacementEquipement} onChange={setEmplacementEquipement} />
                        </div>
                      )}
                      <button type="submit" className="btn-small">
                        Ajouter
                      </button>
                    </form>
                  </>
                )}
              </div>

              <div className="settings-section">
                <h3>Ajouter un relevé</h3>
                <form className="field-row" onSubmit={handleAddReleve} style={{ alignItems: "flex-end" }}>
                  <div className="field" style={{ minWidth: "200px" }}>
                    <label>Équipement</label>
                    <SimpleSelect
                      options={equipements.map((eq) => ({ id: eq.id, label: eq.nom }))}
                      value={equipementReleve}
                      onChange={setEquipementReleve}
                    />
                  </div>
                  <div className="field" style={{ maxWidth: "140px" }}>
                    <label>Température (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={temperatureReleve}
                      onChange={(e) => setTemperatureReleve(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Note (optionnel)</label>
                    <input
                      type="text"
                      placeholder="Action corrective si hors norme"
                      value={noteReleve}
                      onChange={(e) => setNoteReleve(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="submit-btn" disabled={saving || equipements.length === 0}>
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </form>
                {equipements.length === 0 && (
                  <p className="section-hint" style={{ marginTop: "10px" }}>
                    Ajoute d'abord un équipement ci-dessus.
                  </p>
                )}
              </div>

              <div style={{ marginBottom: "14px" }}>
                <EmplacementSelect emplacements={emplacements} value={emplacementFiltre} onChange={setEmplacementFiltre} includeToutes />
              </div>

              {relevesFiltres.length === 0 ? (
                <p style={{ color: "var(--text-dim)" }}>Aucun relevé pour l'instant.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Équipement</th>
                        <th>Température</th>
                        <th>Relevé par</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relevesFiltres.map((r) => (
                        <tr key={r.id}>
                          <td>
                            {new Date(r.created_at).toLocaleDateString("fr-CA")}{" "}
                            {new Date(r.created_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td>{r.equipement?.nom || "?"}</td>
                          <td>{r.conforme ? "✓" : "⚠️"} {r.temperature}°C</td>
                          <td>{r.releve_par}</td>
                          <td>{r.note || ""}</td>
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
