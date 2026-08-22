"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import DashSidebar from "@/components/DashSidebar";
import ModulesModal from "@/components/ModulesModal";
import WidgetCard from "@/components/dashboard/WidgetCard";
import RaccourcisWidget from "@/components/dashboard/RaccourcisWidget";
import PlanningJourWidget from "@/components/dashboard/PlanningJourWidget";
import HoraireJourWidget from "@/components/dashboard/HoraireJourWidget";
import { WIDGETS, fusionnerConfigWidgets } from "@/lib/dashboardWidgets";
import { resoudreEntrepriseActive } from "@/lib/entreprise";

export default function DashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [noForfait, setNoForfait] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [forfait, setForfait] = useState(null);
  const [actifs, setActifs] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);

      supabase
        .from("admins")
        .select("id")
        .eq("email", session.user.email)
        .maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));

      // Un compte peut appartenir à plusieurs entreprises (équipe). On
      // résout celle qui est active pour cette session ; si plusieurs sont
      // possibles et qu'aucune n'est encore choisie, on renvoie vers le
      // sélecteur de dashboard.
      const { entrepriseId: eid, besoinChoix, invitationsEnAttente } = await resoudreEntrepriseActive(supabase);

      if (invitationsEnAttente > 0) {
        router.push("/invitations");
        return;
      }

      if (besoinChoix) {
        router.push("/dashboards");
        return;
      }

      if (eid) {
        setEntrepriseId(eid);

        const { data: entreprise } = await supabase
          .from("entreprises")
          .select("forfait, dashboard_widgets")
          .eq("id", eid)
          .maybeSingle();

        if (entreprise) {
          setForfait(entreprise.forfait);
          if (!entreprise.forfait) setNoForfait(true);
          setWidgetConfig(fusionnerConfigWidgets(entreprise.dashboard_widgets));
        }

        loadActifs(eid);
      }

      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  async function loadActifs(eid) {
    const { data } = await supabase.from("modules_actifs").select("module").eq("entreprise_id", eid);
    setActifs((data || []).map((m) => m.module));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function persisterConfig(config) {
    if (!entrepriseId) return;
    supabase.from("entreprises").update({ dashboard_widgets: config }).eq("id", entrepriseId);
  }

  function handleToggleVisible(id) {
    setWidgetConfig((cur) => {
      const config = cur.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
      persisterConfig(config);
      return config;
    });
  }

  function handleDrop(targetId) {
    setWidgetConfig((cur) => {
      if (!draggedId || draggedId === targetId) return cur;
      const fromIndex = cur.findIndex((w) => w.id === draggedId);
      const toIndex = cur.findIndex((w) => w.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return cur;
      const config = [...cur];
      const [moved] = config.splice(fromIndex, 1);
      config.splice(toIndex, 0, moved);
      persisterConfig(config);
      return config;
    });
    setDraggedId(null);
    setDragOverId(null);
  }

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  const displayName =
    user?.user_metadata?.full_name || user?.user_metadata?.entreprise || user?.email;

  const widgetsEligibles = widgetConfig.filter((w) => {
    const meta = WIDGETS.find((m) => m.id === w.id);
    return meta && (meta.moduleId === null || actifs.includes(meta.moduleId));
  });
  const widgetsAffiches = editMode ? widgetsEligibles : widgetsEligibles.filter((w) => w.visible);

  function renderContenuWidget(id) {
    if (id === "raccourcis") {
      return (
        <RaccourcisWidget
          actifs={actifs}
          forfait={forfait}
          editMode={editMode}
          onOuvrirModules={() => setModalOpen(true)}
        />
      );
    }
    if (id === "planning-jour") return <PlanningJourWidget entrepriseId={entrepriseId} />;
    if (id === "horaire-jour") return <HoraireJourWidget entrepriseId={entrepriseId} />;
    return null;
  }

  return (
    <div className="dash-layout">
      <DashSidebar
        active="dashboard"
        displayName={displayName}
        userEmail={user?.email}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        entrepriseId={entrepriseId}
      />

      <main className="dash-main">
        <div className="dash-main-inner">
          {noForfait && (
            <div className="dash-forfait-banner">
              <span>Vous n'avez aucun forfait actif.</span>
              <Link href="/s-abonner" className="dash-forfait-banner-btn">
                Choisir un forfait →
              </Link>
            </div>
          )}

          <header
            className="dash-hero-inline"
            style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}
          >
            <div>
              <h1>Bienvenue{displayName ? `, ${displayName}` : ""}</h1>
              <p>Voici ton espace. Active un module pour commencer.</p>
            </div>
            <button
              type="button"
              className={`admin-icon-btn dash-edit-btn${editMode ? " active" : ""}`}
              onClick={() => setEditMode((v) => !v)}
              title={editMode ? "Terminer la modification" : "Modifier le tableau de bord"}
            >
              ✏️
            </button>
          </header>

          <div className="dash-widgets-stack">
            {widgetsAffiches.map((w) => {
              const meta = WIDGETS.find((m) => m.id === w.id);
              return (
                <WidgetCard
                  key={w.id}
                  title={meta.nom}
                  editMode={editMode}
                  visible={w.visible}
                  onToggleVisible={() => handleToggleVisible(w.id)}
                  dragOver={dragOverId === w.id}
                  onDragStart={() => setDraggedId(w.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverId(w.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(w.id);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                >
                  {renderContenuWidget(w.id)}
                </WidgetCard>
              );
            })}
          </div>
        </div>
      </main>

      {modalOpen && (
        <ModulesModal
          entrepriseId={entrepriseId}
          onClose={() => setModalOpen(false)}
          onChange={() => loadActifs(entrepriseId)}
        />
      )}
    </div>
  );
}
