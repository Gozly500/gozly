"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import InformationsSection from "@/components/settings/InformationsSection";
import AbonnementSection from "@/components/settings/AbonnementSection";
import ActiviteSection from "@/components/settings/ActiviteSection";
import GestionSection from "@/components/settings/GestionSection";

const TABS = [
  { id: "informations", label: "Informations", icon: "👤" },
  { id: "abonnement", label: "Abonnement", icon: "💳" },
  { id: "activite", label: "Activité du compte", icon: "🕒" },
  { id: "gestion", label: "Gestion du compte", icon: "⚙" },
];

export default function SettingsContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profil, setProfil] = useState(null);
  const [entreprise, setEntreprise] = useState(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState("informations");

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      if (ignore) return;
      setUser(session.user);

      const { data: profilData } = await supabase
        .from("profils")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (ignore) return;

      if (profilData?.entreprise_id) {
        const { data: entrepriseData } = await supabase
          .from("entreprises")
          .select("*")
          .eq("id", profilData.entreprise_id)
          .maybeSingle();
        if (!ignore) setEntreprise(entrepriseData || null);
      }

      setProfil(profilData || null);
      setChecking(false);
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="wrap settings-wrap">
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
        {activeTab === "informations" && (
          <InformationsSection
            user={user}
            profil={profil}
            setProfil={setProfil}
            entreprise={entreprise}
            setEntreprise={setEntreprise}
          />
        )}
        {activeTab === "abonnement" && <AbonnementSection entreprise={entreprise} />}
        {activeTab === "activite" && <ActiviteSection user={user} />}
        {activeTab === "gestion" && <GestionSection user={user} profil={profil} router={router} />}
      </div>
    </div>
  );
}
