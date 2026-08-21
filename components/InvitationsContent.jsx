"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Loader from "@/components/Loader";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { setEntrepriseSelectionnee } from "@/lib/entreprise";

export default function InvitationsContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [invitations, setInvitations] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      load(session.user.email);
    });
  }, [router]);

  async function load(email) {
    const { data } = await supabase
      .from("invitations")
      .select("*, entreprises(nom, logo_url)")
      .eq("email", email)
      .eq("statut", "en_attente")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      router.push("/dashboard");
      return;
    }

    setInvitations(data);
    setChecking(false);
  }

  async function handleAccepter(invitation) {
    setBusyId(invitation.id);
    setError(null);

    const { error } = await supabase.rpc("accepter_invitation", { p_invitation_id: invitation.id });

    if (error) {
      setError("Impossible d'accepter cette invitation : " + error.message);
      setBusyId(null);
      return;
    }

    setEntrepriseSelectionnee(invitation.entreprise_id);
    router.push("/dashboard");
  }

  async function handleRefuser(invitation) {
    setBusyId(invitation.id);
    setError(null);

    const { error } = await supabase.from("invitations").update({ statut: "refusee" }).eq("id", invitation.id);

    if (error) {
      setError("L'opération a échoué : " + error.message);
      setBusyId(null);
      return;
    }

    const remaining = invitations.filter((i) => i.id !== invitation.id);
    if (remaining.length === 0) {
      router.push("/dashboard");
      return;
    }
    setInvitations(remaining);
    setBusyId(null);
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
          <h1>Tu as été invité·e !</h1>
          <p>Réponds avant de continuer vers ton tableau de bord.</p>
        </div>
      </header>

      <section>
        <div className="wrap login-wrap">
          {error && <p className="settings-msg err">{error}</p>}
          <div className="admin-list">
            {invitations.map((inv) => (
              <div className="admin-row" key={inv.id}>
                <div className="admin-row-main">
                  <div className="admin-row-title">{inv.entreprises?.nom || "Entreprise"}</div>
                  <div className="admin-row-sub">t'invite à rejoindre son dashboard</div>
                </div>
                <div className="admin-row-controls">
                  <button className="submit-btn" disabled={busyId === inv.id} onClick={() => handleAccepter(inv)}>
                    Accepter
                  </button>
                  <button className="admin-icon-btn" disabled={busyId === inv.id} onClick={() => handleRefuser(inv)}>
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
