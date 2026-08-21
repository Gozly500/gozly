"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import DashSidebar from "@/components/DashSidebar";
import ModulesModal from "@/components/ModulesModal";
import { MODULES, limiteModules } from "@/lib/modules";
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
          .select("forfait")
          .eq("id", eid)
          .maybeSingle();

        if (entreprise) {
          setForfait(entreprise.forfait);
          if (!entreprise.forfait) setNoForfait(true);
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

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  const displayName =
    user?.user_metadata?.full_name || user?.user_metadata?.entreprise || user?.email;

  const limite = limiteModules(forfait);
  const modulesActifs = MODULES.filter((m) => actifs.includes(m.id));
  const placeholders = Math.max(0, Math.min(limite === Infinity ? 4 : limite, 4) - modulesActifs.length);

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

          <header className="dash-hero-inline">
            <h1>Bienvenue{displayName ? `, ${displayName}` : ""}</h1>
            <p>Voici ton espace. Active un module pour commencer.</p>
          </header>

          <div className="dash-modules-grid">
            {modulesActifs.map((mod) => (
              <Link
                key={mod.id}
                href={mod.href}
                className={`dash-module-card active${mod.image ? "" : " fallback"}`}
                title={mod.nom}
              >
                {mod.image ? (
                  <img src={mod.image} alt={mod.nom} className="dash-module-image" />
                ) : (
                  <>
                    <span className="dash-module-emoji">{mod.icon}</span>
                    <span className="dash-module-name">{mod.nom}</span>
                  </>
                )}
              </Link>
            ))}
            {Array.from({ length: placeholders }).map((_, i) => (
              <div key={i} className="dash-module-card" onClick={() => setModalOpen(true)}>
                +
              </div>
            ))}
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
