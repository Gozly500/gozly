"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashSidebar from "@/components/DashSidebar";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { TYPES_EQUIPEMENT, UNITES } from "@/lib/temperature";
import EmplacementSelect from "@/components/EmplacementSelect";
import SimpleSelect from "@/components/SimpleSelect";

export default function TemperatureEquipementsContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);

  const [emplacements, setEmplacements] = useState([]);
  const [equipements, setEquipements] = useState([]);
  const [loadingDonnees, setLoadingDonnees] = useState(true);

  const [nomEquipement, setNomEquipement] = useState("");
  const [typeEquipement, setTypeEquipement] = useState("refrigerateur");
  const [uniteEquipement, setUniteEquipement] = useState("C");
  const [emplacementEquipement, setEmplacementEquipement] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editType, setEditType] = useState("refrigerateur");
  const [editUnite, setEditUnite] = useState("C");

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
    const [{ data: emps }, { data: eqs }] = await Promise.all([
      supabase.from("emplacements").select("*").eq("entreprise_id", entrepriseId).order("created_at", { ascending: true }),
      supabase.from("equipements_temperature").select("*").eq("entreprise_id", entrepriseId).order("nom", { ascending: true }),
    ]);
    setEmplacements(emps || []);
    setEquipements(eqs || []);
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
      unite: uniteEquipement,
      emplacement_id: emplacementEquipement,
    });
    setNomEquipement("");
    setTypeEquipement("refrigerateur");
    setUniteEquipement("C");
    setEmplacementEquipement(null);
    load();
  }

  async function handleDeleteEquipement(id) {
    await supabase.from("equipements_temperature").delete().eq("id", id);
    load();
  }

  function startEdit(eq) {
    setEditingId(eq.id);
    setEditType(eq.type);
    setEditUnite(eq.unite || "C");
  }

  async function handleSaveEdit(id) {
    await supabase.from("equipements_temperature").update({ type: editType, unite: editUnite }).eq("id", id);
    setEditingId(null);
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

  return (
    <div className="dash-layout">
      <DashSidebar
        active="temperature-equipements"
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
              <h1>Équipements - Températures</h1>
              <p>Les équipements à surveiller (frigos, congélateurs, maintien au chaud).</p>
            </div>
          </header>

          {!entrepriseId ? (
            <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
          ) : loadingDonnees ? (
            <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
          ) : (
            <>
              <div className="settings-section">
                <h3>Équipements</h3>
                <div className="admin-list" style={{ marginTop: "14px", maxWidth: "560px" }}>
                  {equipements.map((eq) => (
                    <div className="admin-row" style={{ flexDirection: "column", alignItems: "stretch" }} key={eq.id}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                        <div className="admin-row-main">
                          <div className="admin-row-title">{eq.nom}</div>
                          <div className="admin-row-sub">
                            {TYPES_EQUIPEMENT.find((t) => t.id === eq.type)?.label} · °{eq.unite === "F" ? "F" : "C"}
                            {eq.emplacement_id && " · " + (emplacements.find((e) => e.id === eq.emplacement_id)?.nom || "")}
                          </div>
                        </div>
                        <div className="admin-row-controls">
                          {editingId === eq.id ? (
                            <>
                              <button className="admin-icon-btn" onClick={() => handleSaveEdit(eq.id)}>
                                Enregistrer
                              </button>
                              <button className="admin-icon-btn" onClick={() => setEditingId(null)}>
                                Annuler
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="admin-icon-btn" onClick={() => startEdit(eq)}>
                                Modifier
                              </button>
                              <button className="admin-icon-btn danger" onClick={() => handleDeleteEquipement(eq.id)}>
                                Retirer
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {editingId === eq.id && (
                        <div className="field-row" style={{ marginTop: "12px" }}>
                          <div className="field" style={{ minWidth: "200px" }}>
                            <label>Type</label>
                            <SimpleSelect
                              options={TYPES_EQUIPEMENT.map((t) => ({ id: t.id, label: t.label }))}
                              value={editType}
                              onChange={setEditType}
                            />
                          </div>
                          <div className="field" style={{ minWidth: "180px" }}>
                            <label>Unité</label>
                            <SimpleSelect options={UNITES} value={editUnite} onChange={setEditUnite} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {equipements.length === 0 && <div className="admin-empty">Aucun équipement pour l'instant.</div>}
                </div>
              </div>

              <div className="settings-section">
                <h3>Ajouter un équipement</h3>
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
                  <div className="field" style={{ minWidth: "180px" }}>
                    <label>Unité</label>
                    <SimpleSelect options={UNITES} value={uniteEquipement} onChange={setUniteEquipement} />
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
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
