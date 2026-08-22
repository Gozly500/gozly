"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashSidebar from "@/components/DashSidebar";
import EmplacementSelect from "@/components/EmplacementSelect";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive, getEmplacementSelectionne, setEmplacementSelectionne } from "@/lib/entreprise";

export default function PlanningContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [days, setDays] = useState([]);
  const [loadingDays, setLoadingDays] = useState(true);
  const [pickingDate, setPickingDate] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  const [emplacements, setEmplacements] = useState([]);
  const [emplacementId, setEmplacementIdState] = useState(null);

  function setEmplacementId(id) {
    setEmplacementIdState(id);
    if (entrepriseId) setEmplacementSelectionne(entrepriseId, id);
  }

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

      if (eid) {
        const { data: emplacementsData } = await supabase
          .from("emplacements")
          .select("*")
          .eq("entreprise_id", eid)
          .order("created_at", { ascending: true });

        const list = emplacementsData || [];
        setEmplacements(list);

        let selected = null;
        if (list.length > 0) {
          const saved = getEmplacementSelectionne(eid);
          selected = saved && list.some((e) => e.id === saved) ? saved : list[0].id;
          setEmplacementIdState(selected);
          setEmplacementSelectionne(eid, selected);
        }

        loadDays(eid, list.length > 0 ? selected : null);
      }
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  async function loadDays(eid, filtreEmplacementId) {
    setLoadingDays(true);
    let query = supabase.from("taches").select("date, terminee").eq("entreprise_id", eid);
    if (filtreEmplacementId) query = query.eq("emplacement_id", filtreEmplacementId);
    const { data } = await query;

    const byDate = new Map();
    (data || []).forEach((t) => {
      const entry = byDate.get(t.date) || { total: 0, faites: 0 };
      entry.total += 1;
      if (t.terminee) entry.faites += 1;
      byDate.set(t.date, entry);
    });

    const list = [...byDate.entries()]
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    setDays(list);
    setLoadingDays(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handlePickDate(e) {
    const date = e.target.value;
    if (date) router.push(`/dashboard/planning/${date}`);
  }

  function handleChangeEmplacement(id) {
    setEmplacementId(id);
    loadDays(entrepriseId, id);
  }

  async function handleDeleteDay(date) {
    let query = supabase.from("taches").delete().eq("entreprise_id", entrepriseId).eq("date", date);
    if (emplacementId) query = query.eq("emplacement_id", emplacementId);
    await query;
    setConfirmingDelete(null);
    setDays((prev) => prev.filter((d) => d.date !== date));
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
        active="planning"
        displayName={displayName}
        userEmail={user?.email}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        entrepriseId={entrepriseId}
      />

      <main className="dash-main">
        <div className="dash-main-inner">
          <header className="dash-hero-inline" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
            <div>
              <h1>Planning</h1>
              <p>Les journées de tâches déjà créées.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Link href="/dashboard/planning-kiosk" target="_blank" className="admin-icon-btn">
                🖥 Ouvrir le kiosque
              </Link>
              <div style={{ position: "relative" }}>
                <button className="submit-btn" onClick={() => setPickingDate((v) => !v)}>
                  + Nouvelle journée
                </button>
                {pickingDate && (
                  <input
                    type="date"
                    autoFocus
                    className="planning-date-picker"
                    onChange={handlePickDate}
                    onBlur={() => setPickingDate(false)}
                  />
                )}
              </div>
            </div>
          </header>

          <EmplacementSelect emplacements={emplacements} value={emplacementId} onChange={handleChangeEmplacement} />

          {!entrepriseId ? (
            <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
          ) : loadingDays ? (
            <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
          ) : (
            <div className="admin-list">
              {days.map((day) => (
                <div className="admin-row" key={day.date}>
                  <div className="admin-row-main">
                    <div className="admin-row-title" style={{ textTransform: "capitalize" }}>
                      {new Date(day.date + "T00:00:00").toLocaleDateString("fr-CA", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                    <div className="admin-row-sub">
                      {day.faites}/{day.total} tâche{day.total > 1 ? "s" : ""} terminée{day.faites > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="admin-row-controls">
                    <button className="admin-icon-btn" onClick={() => router.push(`/dashboard/planning/${day.date}`)}>
                      Modifier
                    </button>
                    {confirmingDelete === day.date ? (
                      <>
                        <button className="btn-danger" onClick={() => handleDeleteDay(day.date)}>
                          Confirmer
                        </button>
                        <button className="admin-icon-btn" onClick={() => setConfirmingDelete(null)}>
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button className="admin-icon-btn danger" onClick={() => setConfirmingDelete(day.date)}>
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {days.length === 0 && (
                <div className="admin-empty">Aucune journée créée. Clique "Nouvelle journée" pour commencer.</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
