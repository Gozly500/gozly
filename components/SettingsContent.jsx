"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import InformationsSection from "@/components/settings/InformationsSection";
import AbonnementSection from "@/components/settings/AbonnementSection";
import ActiviteSection from "@/components/settings/ActiviteSection";
import AppearanceSection from "@/components/settings/AppearanceSection";
import GestionSection from "@/components/settings/GestionSection";

const TABS = [
  { id: "informations", label: "Informations", icon: "👤" },
  { id: "abonnement", label: "Abonnement", icon: "💳" },
  { id: "apparence", label: "Apparence", icon: "🎨" },
  { id: "activite", label: "Activité du compte", icon: "🕒" },
  { id: "gestion", label: "Gestion du compte", icon: "⚙" },
];

export default function SettingsContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profil, setProfil] = useState(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState("informations");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Retour de Stripe (?checkout=...) ou arrivée depuis l'inscription
    // (?acheter=...) : ouvrir directement l'onglet Abonnement.
    if (params.has("checkout") || params.has("acheter")) {
      setActiveTab("abonnement");
      return;
    }
    const tab = params.get("tab");
    if (TABS.some((t) => t.id === tab)) setActiveTab(tab);
  }, []);

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
      setProfil(profilData || null);

      // Cette page (nom, photo, mot de passe, abonnement) est entièrement
      // liée au COMPTE, pas à une entreprise en particulier - contrairement
      // à avant, plus besoin de résoudre "l'entreprise active" ici. On garde
      // seulement le renvoi vers les invitations en attente.
      const { count: invitationsEnAttente } = await supabase
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .eq("email", session.user.email)
        .eq("statut", "en_attente");
      if (ignore) return;

      if ((invitationsEnAttente || 0) > 0) {
        router.push("/invitations");
        return;
      }

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
        {activeTab === "informations" && <InformationsSection user={user} profil={profil} setProfil={setProfil} />}
        {activeTab === "abonnement" && <AbonnementSection profil={profil} />}
        {activeTab === "apparence" && <AppearanceSection profil={profil} setProfil={setProfil} />}
        {activeTab === "activite" && <ActiviteSection user={user} />}
        {activeTab === "gestion" && <GestionSection user={user} profil={profil} router={router} />}
      </div>
    </div>
  );
}
