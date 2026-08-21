"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashSidebar from "@/components/DashSidebar";
import { supabase } from "@/lib/supabaseClient";

export default function PlanningContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [days, setDays] = useState([]);
  const [loadingDays, setLoadingDays] = useState(true);
  const [pickingDate, setPickingDate] = useState(false);

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

      const { data: profil } = await supabase
        .from("profils")
        .select("entreprise_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (ignore) return;
      const eid = profil?.entreprise_id || null;
      setEntrepriseId(eid);
      setChecking(false);

      if (eid) loadDays(eid);
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  async function loadDays(eid) {
    setLoadingDays(true);
    const { data } = await supabase.from("taches").select("date, terminee").eq("entreprise_id", eid);

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
          </header>

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
