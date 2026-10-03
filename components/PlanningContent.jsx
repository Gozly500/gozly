"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashSidebar from "@/components/DashSidebar";
import EmplacementSelect from "@/components/EmplacementSelect";
import JourEditor from "@/components/planning/JourEditor";
import { supabase } from "@/lib/supabaseClient";
import { getDebutSemaine, addDays } from "@/lib/semaine";
import { resoudreEntrepriseActive, getEmplacementSelectionne, setEmplacementSelectionne } from "@/lib/entreprise";

function dateStr(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PlanningContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [days, setDays] = useState([]);
  const [date, setDate] = useState(() => dateStr(new Date())); // jour affiché sous le calendrier
  const [creees, setCreees] = useState(new Set()); // jours "créés" ici mais encore sans tâche
  const [premierJourDimanche, setPremierJourDimanche] = useState(false);
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
        supabase
          .from("entreprises")
          .select("premier_jour_semaine")
          .eq("id", eid)
          .maybeSingle()
          .then(({ data }) => setPremierJourDimanche(data?.premier_jour_semaine === "dimanche"));

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
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function handleChangeEmplacement(id) {
    setEmplacementId(id);
    loadDays(entrepriseId, id);
  }

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.entreprise || user?.email;

  // Calendrier de la semaine qui contient le jour affiché.
  const debutSemaine = getDebutSemaine(new Date(`${date}T00:00:00`), premierJourDimanche);
  const jours = Array.from({ length: 7 }, (_, i) => addDays(debutSemaine, i));
  const aujourdhui = dateStr(new Date());
  const statsJour = days.find((d) => d.date === date);
  const jourExiste = (statsJour?.total || 0) > 0 || creees.has(date);
  const decalerSemaine = (n) => setDate(dateStr(addDays(new Date(`${date}T00:00:00`), n * 7)));

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
              <h1>Tâches</h1>
              <p>Choisis un jour pour voir ou préparer ses tâches.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Link href="/dashboard/planning-kiosk" target="_blank" className="admin-icon-btn">
                🖥 Ouvrir le kiosque
              </Link>
            </div>
          </header>

          <EmplacementSelect emplacements={emplacements} value={emplacementId} onChange={handleChangeEmplacement} />

          {entrepriseId && (
            <div className="cmd-planif" style={{ position: "static", maxHeight: "none", marginBottom: "26px" }}>
              <div className="cmd-planif-head">
                <h3 style={{ textTransform: "capitalize" }}>
                  {debutSemaine.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} –{" "}
                  {addDays(debutSemaine, 6).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}
                </h3>
                <div style={{ display: "flex", gap: "6px" }}>
                  {date !== aujourdhui && (
                    <button className="admin-icon-btn" onClick={() => setDate(aujourdhui)}>
                      Aujourd&apos;hui
                    </button>
                  )}
                  <button className="admin-icon-btn" aria-label="Semaine précédente" onClick={() => decalerSemaine(-1)}>
                    ‹
                  </button>
                  <button className="admin-icon-btn" aria-label="Semaine suivante" onClick={() => decalerSemaine(1)}>
                    ›
                  </button>
                </div>
              </div>

              <div className="cmd-planif-jours">
                {jours.map((d) => {
                  const id = dateStr(d);
                  const stats = days.find((x) => x.date === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`cmd-planif-jour${id === date ? " actif" : ""}${id === aujourdhui ? " aujourdhui" : ""}`}
                      onClick={() => setDate(id)}
                    >
                      <span className="cmd-planif-jour-nom">{d.toLocaleDateString("fr-CA", { weekday: "short" }).replace(".", "")}</span>
                      <span className="cmd-planif-jour-num">{d.getDate()}</span>
                      <span className="cmd-planif-jour-nb">{stats ? `${stats.faites}/${stats.total}` : "—"}</span>
                    </button>
                  );
                })}
              </div>

              {jourExiste ? (
                <JourEditor
                  key={`${date}-${emplacementId || "toutes"}`}
                  entrepriseId={entrepriseId}
                  date={date}
                  integre
                  sansEmplacement
                  onChange={() => loadDays(entrepriseId, emplacementId)}
                />
              ) : (
                <div style={{ textAlign: "center", padding: "26px 10px" }}>
                  <p style={{ color: "var(--text-dim)", marginBottom: "14px" }}>
                    Aucune tâche pour le{" "}
                    {new Date(`${date}T00:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}.
                  </p>
                  <button className="submit-btn" onClick={() => setCreees((prev) => new Set(prev).add(date))}>
                    Créer cette journée
                  </button>
                </div>
              )}
            </div>
          )}

          {!entrepriseId && <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>}
        </div>
      </main>
    </div>
  );
}
