"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import DashSidebar from "@/components/DashSidebar";

export default function DashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [noForfait, setNoForfait] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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

      // Vérifie si ce compte a une entreprise liée, et si elle a un forfait actif.
      // Les comptes sans profil (comme un compte admin créé manuellement)
      // ignorent simplement cette vérification.
      const { data: profil } = await supabase
        .from("profils")
        .select("entreprise_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profil?.entreprise_id) {
        const { data: entreprise } = await supabase
          .from("entreprises")
          .select("forfait")
          .eq("id", profil.entreprise_id)
          .maybeSingle();

        if (entreprise && !entreprise.forfait) {
          setNoForfait(true);
        }
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

  return (
    <div className="dash-layout">
      <DashSidebar
        active="dashboard"
        displayName={displayName}
        userEmail={user?.email}
        isAdmin={isAdmin}
        onLogout={handleLogout}
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
            <Link href="/dashboard/planning" className="dash-module-card active" title="Planning">
              <img src="/icone-planning.svg" alt="Planning" className="dash-module-image" />
            </Link>
            <div className="dash-module-card">+</div>
            <div className="dash-module-card">+</div>
            <div className="dash-module-card">+</div>
          </div>
        </div>
      </main>
    </div>
  );
}
