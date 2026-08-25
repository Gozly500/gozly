"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashSidebar from "@/components/DashSidebar";
import ProduitsSection from "@/components/inventaire/ProduitsSection";
import DemandeReapproSection from "@/components/inventaire/DemandeReapproSection";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { IconInventaire, IconDemande } from "@/components/icons/GozlyIcons";

const TABS = [
  { id: "produits", label: "Produits", Icone: IconInventaire },
  { id: "reappro", label: "Liste à préparer", Icone: IconDemande },
];

export default function InventaireContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [activeTab, setActiveTab] = useState("produits");

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
        active="inventaire"
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
              <h1>Inventaire</h1>
              <p>Tes produits et la liste de ce qu'il faut aller chercher.</p>
            </div>
            <Link href="/dashboard/inventaire-kiosk" target="_blank" className="admin-icon-btn">
              🖥 Ouvrir le mode kiosk
            </Link>
          </header>

          {!entrepriseId ? (
            <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
          ) : (
            <>
              <div className="settings-nav" style={{ flexDirection: "row", marginBottom: "28px", width: "fit-content" }}>
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`settings-nav-item${activeTab === tab.id ? " active" : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="icon">{tab.Icone ? <tab.Icone className="gozly-icon" /> : tab.icon}</span> {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "produits" && <ProduitsSection entrepriseId={entrepriseId} />}
              {activeTab === "reappro" && <DemandeReapproSection entrepriseId={entrepriseId} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
