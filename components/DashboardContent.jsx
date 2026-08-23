"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconCrayon } from "@/components/icons/GozlyIcons";
import { supabase } from "@/lib/supabaseClient";
import DashSidebar from "@/components/DashSidebar";
import WidgetCard from "@/components/dashboard/WidgetCard";
import WidgetPalette from "@/components/dashboard/WidgetPalette";
import DropSlot from "@/components/dashboard/DropSlot";
import RaccourcisWidget from "@/components/dashboard/RaccourcisWidget";
import PlanningJourWidget from "@/components/dashboard/PlanningJourWidget";
import HoraireJourWidget from "@/components/dashboard/HoraireJourWidget";
import InventaireWidget from "@/components/dashboard/InventaireWidget";
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
  const [widgetConfig, setWidgetConfig] = useState([]);
  const [modulesCaches, setModulesCaches] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);

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
          .select("forfait, dashboard_widgets, raccourcis_modules_caches")
          .eq("id", eid)
          .maybeSingle();

        if (entreprise) {
          setForfait(entreprise.forfait);
          if (!entreprise.forfait) setNoForfait(true);
          setWidgetConfig(fusionnerConfigWidgets(entreprise.dashboard_widgets));
          setModulesCaches(entreprise.raccourcis_modules_caches || []);
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

  function handleToggleModuleCache(moduleId) {
    setModulesCaches((cur) => {
      const nouveau = cur.includes(moduleId) ? cur.filter((id) => id !== moduleId) : [...cur, moduleId];
      if (entrepriseId) {
        supabase.from("entreprises").update({ raccourcis_modules_caches: nouveau }).eq("id", entrepriseId);
      }
      return nouveau;
    });
  }

  function handleRemove(id) {
    setWidgetConfig((cur) => {
      const config = cur.map((w) => (w.id === id ? { ...w, visible: false } : w));
      persisterConfig(config);
      return config;
    });
  }

  // Insère (ou déplace) le widget `id` à la position `indexParmiPlaces`
  // parmi les widgets actuellement visibles - utilisé aussi bien pour
  // ajouter un widget depuis la palette que pour réordonner la grille.
  function handleDropSurSlot(indexParmiPlaces) {
    if (!draggedId) return;
    setWidgetConfig((cur) => {
      const sansWidget = cur.filter((w) => w.id !== draggedId);
      const widget = { id: draggedId, visible: true };
      const placesVisibles = sansWidget.filter((w) => w.visible);

      let config;
      if (indexParmiPlaces >= placesVisibles.length) {
        config = [...sansWidget, widget];
      } else {
        const idCible = placesVisibles[indexParmiPlaces].id;
        const posCible = sansWidget.findIndex((w) => w.id === idCible);
        config = [...sansWidget.slice(0, posCible), widget, ...sansWidget.slice(posCible)];
      }

      persisterConfig(config);
      return config;
    });
    setDraggedId(null);
    setDragOverSlot(null);
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
  const widgetsPlaces = widgetsEligibles.filter((w) => w.visible);
  const widgetsPalette = widgetsEligibles
    .filter((w) => !w.visible)
    .map((w) => ({ id: w.id, nom: WIDGETS.find((m) => m.id === w.id)?.nom || w.id }));

  function renderContenuWidget(id) {
    if (id === "raccourcis") {
      return (
        <RaccourcisWidget
          actifs={actifs}
          editMode={editMode}
          modulesCaches={modulesCaches}
          onToggleModule={handleToggleModuleCache}
        />
      );
    }
    if (id === "planning-jour") return <PlanningJourWidget entrepriseId={entrepriseId} />;
    if (id === "horaire-jour") return <HoraireJourWidget entrepriseId={entrepriseId} />;
    if (id === "inventaire-alertes") return <InventaireWidget entrepriseId={entrepriseId} />;
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
        <div className="dash-main-inner dash-main-wide">
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
              <IconCrayon className="gozly-icon" />
            </button>
          </header>

          <div className={editMode ? "dash-edit-layout" : undefined}>
            <div className="dash-widgets-grid">
              {editMode && draggedId && (
                <DropSlot
                  dragOver={dragOverSlot === 0}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverSlot(0);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropSurSlot(0);
                  }}
                />
              )}
              {widgetsPlaces.map((w, i) => {
                const meta = WIDGETS.find((m) => m.id === w.id);
                return (
                  <div key={w.id} style={{ display: "contents" }}>
                    <WidgetCard
                      title={meta.nom}
                      taille={meta.taille}
                      editMode={editMode}
                      onRemove={() => handleRemove(w.id)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", w.id);
                        setDraggedId(w.id);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverSlot(null);
                      }}
                    >
                      {renderContenuWidget(w.id)}
                    </WidgetCard>
                    {editMode && draggedId && (
                      <DropSlot
                        dragOver={dragOverSlot === i + 1}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverSlot(i + 1);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropSurSlot(i + 1);
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {editMode && (
              <WidgetPalette widgets={widgetsPalette} onDragStart={setDraggedId} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
