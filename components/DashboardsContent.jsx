"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { listerMesEntreprises, setEntrepriseSelectionnee } from "@/lib/entreprise";

export default function DashboardsContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [entreprises, setEntreprises] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }

      const list = await listerMesEntreprises(supabase);

      if (list.length === 0) {
        router.push("/dashboard");
        return;
      }
      if (list.length === 1) {
        setEntrepriseSelectionnee(list[0].id);
        router.push("/dashboard");
        return;
      }

      setEntreprises(list);
      setChecking(false);
    });
  }, [router]);

  function choisir(entrepriseId) {
    setEntrepriseSelectionnee(entrepriseId);
    router.push("/dashboard");
  }

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="page page-default">
      <Loader />
      <Nav />

      <header className="page-hero">
        <div className="wrap">
          <h1>Choisis un dashboard</h1>
          <p>Ton compte a accès à plusieurs entreprises.</p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="dashboard-picker-grid">
            {entreprises.map((e) => (
              <button key={e.id} className="dashboard-picker-card" onClick={() => choisir(e.id)}>
                <div className="dashboard-picker-logo">
                  {e.logo_url ? <img src={e.logo_url} alt="" /> : (e.nom || "?").charAt(0).toUpperCase()}
                </div>
                <div className="dashboard-picker-nom">{e.nom}</div>
                <div className="dashboard-picker-role">{e.role === "proprietaire" ? "Propriétaire" : "Membre"}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
