"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardContent() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);
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
    <>
      <div className="dash-topbar">
        <div className="wrap dash-topbar-inner">
          <Link href="/" className="dash-brand">
            Gozly
          </Link>
          <button onClick={handleLogout} className="btn-navy" style={{ cursor: "pointer" }}>
            Déconnexion
          </button>
        </div>
      </div>

      <header className="dash-hero">
        <div className="wrap">
          <h1>Bienvenue{displayName ? `, ${displayName}` : ""}</h1>
          <p>Voici ton espace. Active un module pour commencer.</p>
        </div>
      </header>

      <section className="dash-modules">
        <div className="wrap">
          <div className="mock" style={{ maxWidth: "700px", margin: "0 auto" }}>
            <div className="mock-topbar">
              <div className="mock-dot"></div>
              <div className="mock-dot"></div>
              <div className="mock-dot"></div>
            </div>
            <div className="mock-grid">
              <div className="mock-card add">+</div>
              <div className="mock-card add">+</div>
              <div className="mock-card add">+</div>
              <div className="mock-card add">+</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
