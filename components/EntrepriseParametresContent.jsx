"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashSidebar from "@/components/DashSidebar";
import EquipeSection from "@/components/entreprise/EquipeSection";
import EmplacementsSection from "@/components/entreprise/EmplacementsSection";
import PersonnalisationSection from "@/components/entreprise/PersonnalisationSection";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";

const TABS = [
  { id: "equipe", label: "Équipe", icon: "🤝" },
  { id: "emplacements", label: "Emplacements", icon: "📍" },
  { id: "personnalisation", label: "Personnalisation", icon: "🎨" },
];

export default function EntrepriseParametresContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [activeTab, setActiveTab] = useState("equipe");

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

  return (
    <div className="dash-layout">
      <DashSidebar
        active="entreprise"
        displayName={displayName}
        userEmail={user?.email}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        entrepriseId={entrepriseId}
      />

      <main className="dash-main">
        <div className="dash-main-inner">
          {!entrepriseId ? (
            <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
          ) : (
            <div className="settings-wrap" style={{ maxWidth: "none", padding: 0 }}>
              <nav className="settings-nav">
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
              </nav>

              <div className="settings-panel">
                {activeTab === "equipe" && (
                  <EquipeSection entrepriseId={entrepriseId} userId={user?.id} onLeft={() => router.push("/dashboards")} />
                )}
                {activeTab === "emplacements" && <EmplacementsSection entrepriseId={entrepriseId} />}
                {activeTab === "personnalisation" && <PersonnalisationSection entrepriseId={entrepriseId} />}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
