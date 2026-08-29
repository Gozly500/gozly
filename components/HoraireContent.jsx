"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashSidebar from "@/components/DashSidebar";
import HoraireSection from "@/components/horaire/HoraireSection";
import FeuilleTempsSection from "@/components/horaire/FeuilleTempsSection";
import DemandesSection from "@/components/entreprise/DemandesSection";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { IconHoraire, IconFeuilleTemps, IconDemande } from "@/components/icons/GozlyIcons";

const PERMISSIONS_FEUILLE = ["voir_feuille_temps", "corriger_feuille_temps", "approuver_feuille_temps", "exporter_feuille_temps"];

const TABS = [
  { id: "horaire", label: "Horaire", Icone: IconHoraire },
  { id: "feuille", label: "Feuille de temps", Icone: IconFeuilleTemps },
  { id: "demandes", label: "Demandes", Icone: IconDemande },
];

export default function HoraireContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [activeTab, setActiveTab] = useState("horaire");
  // null = illimité (propriétaire, ou pas encore chargé)
  const [mesPermissions, setMesPermissions] = useState(null);

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
    if (!entrepriseId || !user) return;
    supabase
      .from("membres")
      .select("id, role")
      .eq("entreprise_id", entrepriseId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(async ({ data: membre }) => {
        if (!membre || membre.role === "proprietaire") {
          setMesPermissions(null);
          return;
        }
        const { data: perms } = await supabase.from("membre_permissions").select("permission").eq("membre_id", membre.id);
        setMesPermissions((perms || []).map((p) => p.permission));
      });
  }, [entrepriseId, user]);

  const peutGererHoraire = !mesPermissions || mesPermissions.includes("gerer_horaire");
  const peutVoirFeuille = !mesPermissions || PERMISSIONS_FEUILLE.some((p) => mesPermissions.includes(p));
  const tabsVisibles = TABS.filter((t) => (t.id === "horaire" ? peutGererHoraire : t.id === "feuille" ? peutVoirFeuille : true));

  useEffect(() => {
    if (tabsVisibles.length > 0 && !tabsVisibles.some((t) => t.id === activeTab)) {
      setActiveTab(tabsVisibles[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peutGererHoraire, peutVoirFeuille]);

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
        active="horaire"
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
              <h1>Horaire & Pointage</h1>
              <p>Planifie qui travaille quand, et suis les heures réelles.</p>
            </div>
            <Link href="/dashboard/pointage" target="_blank" className="admin-icon-btn">
              🖥 Ouvrir l'écran de pointage
            </Link>
          </header>

          {!entrepriseId ? (
            <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
          ) : (
            <>
              <div className="settings-nav" style={{ flexDirection: "row", marginBottom: "28px", width: "fit-content" }}>
                {tabsVisibles.map((tab) => (
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

              {activeTab === "horaire" && <HoraireSection entrepriseId={entrepriseId} />}
              {activeTab === "feuille" && <FeuilleTempsSection entrepriseId={entrepriseId} />}
              {activeTab === "demandes" && <DemandesSection entrepriseId={entrepriseId} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
