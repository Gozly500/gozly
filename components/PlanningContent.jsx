"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashSidebar from "@/components/DashSidebar";
import EmployesSection from "@/components/planning/EmployesSection";
import HoraireSection from "@/components/planning/HoraireSection";
import { supabase } from "@/lib/supabaseClient";

const TABS = [
  { id: "horaire", label: "Horaire", icon: "◷" },
  { id: "employes", label: "Employés", icon: "👤" },
];

export default function PlanningContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [activeTab, setActiveTab] = useState("horaire");

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

      if (!ignore) {
        setEntrepriseId(profil?.entreprise_id || null);
        setChecking(false);
      }
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.entreprise || user?.email;

  if (!entrepriseId) {
    return (
      <div className="dash-layout">
        <DashSidebar
          active="planning"
          displayName={displayName}
          userEmail={user?.email}
          isAdmin={isAdmin}
          onLogout={handleLogout}
        />
        <main className="dash-main">
          <div className="dash-main-inner">
            <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dash-layout">
      <DashSidebar
        active="planning"
        displayName={displayName}
        userEmail={user?.email}
        isAdmin={isAdmin}
        onLogout={handleLogout}
      />

      <main className="dash-main">
        <div className="dash-main-inner">
          <header className="dash-hero-inline">
            <h1>Planning</h1>
            <p>Gère tes employés et ton horaire de la semaine.</p>
          </header>

          <div className="settings-nav" style={{ flexDirection: "row", marginBottom: "28px", width: "fit-content" }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`settings-nav-item${activeTab === tab.id ? " active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="icon">{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "horaire" && <HoraireSection entrepriseId={entrepriseId} />}
          {activeTab === "employes" && <EmployesSection entrepriseId={entrepriseId} />}
        </div>
      </main>
    </div>
  );
}
