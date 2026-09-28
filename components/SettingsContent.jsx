"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
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
  const [entreprise, setEntreprise] = useState(null);
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

      // L'entreprise à afficher/modifier ici (Informations, Abonnement) doit
      // être celle actuellement ACTIVE (même résolution que le tableau de
      // bord et le sélecteur "⇄ Changer de dashboard") - pas systématiquement
      // la toute première créée à l'inscription (profils.entreprise_id),
      // sinon un compte avec plusieurs entreprises modifierait la mauvaise
      // sans le savoir.
      const { entrepriseId, besoinChoix, invitationsEnAttente } = await resoudreEntrepriseActive(supabase);
      if (ignore) return;

      if (invitationsEnAttente > 0) {
        router.push("/invitations");
        return;
      }
      if (besoinChoix) {
        router.push("/dashboards");
        return;
      }

      if (entrepriseId) {
        const { data: entrepriseData } = await supabase
          .from("entreprises")
          .select("*")
          .eq("id", entrepriseId)
          .maybeSingle();
        if (!ignore) setEntreprise(entrepriseData || null);
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
        {activeTab === "informations" && (
          <InformationsSection
            user={user}
            profil={profil}
            setProfil={setProfil}
            entreprise={entreprise}
            setEntreprise={setEntreprise}
          />
        )}
        {activeTab === "abonnement" && <AbonnementSection profil={profil} />}
        {activeTab === "apparence" && <AppearanceSection profil={profil} setProfil={setProfil} />}
        {activeTab === "activite" && <ActiviteSection user={user} />}
        {activeTab === "gestion" && <GestionSection user={user} profil={profil} router={router} />}
      </div>
    </div>
  );
}
