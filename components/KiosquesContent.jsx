"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashSidebar from "@/components/DashSidebar";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { MODULES } from "@/lib/modules";
import { KIOSQUES } from "@/lib/kiosques";
import { IconEcran } from "@/components/icons/Pictogrammes";

// Tous les écrans kiosque de l'entreprise, au même endroit (un par module actif qui en a un).
export default function KiosquesContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [actifs, setActifs] = useState([]);

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
      if (eid) {
        const { data } = await supabase.from("modules_actifs").select("module").eq("entreprise_id", eid);
        if (!ignore) setActifs((data || []).map((m) => m.module));
      }
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
  const disponibles = KIOSQUES.filter((k) => actifs.includes(k.module));

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
          <header className="dash-hero-inline">
            <h1>Mode kiosque</h1>
            <p>Les écrans à laisser ouverts sur une tablette ou un écran du commerce. Chacun s&apos;ouvre dans un nouvel onglet.</p>
            <p style={{ marginTop: "8px" }}>
              Pour une tablette : ouvre <strong>gozly.net/kiosque</strong> dessus, installe l&apos;app, puis connecte-toi — tu pourras choisir le kiosque à afficher.{" "}
              <Link href="/kiosque" target="_blank">Ouvrir la page d&apos;installation</Link>
            </p>
          </header>

          {!entrepriseId ? (
            <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>
          ) : disponibles.length === 0 ? (
            <p className="chat-empty">Aucun kiosque disponible : active un module (Horaire &amp; Pointage, Tâches, Inventaire ou Commandes) avec « Gérer les modules ».</p>
          ) : (
            <div className="admin-list" style={{ maxWidth: "720px" }}>
              {disponibles.map((k) => {
                const module = MODULES.find((m) => m.id === k.module);
                return (
                  <div className="admin-row" key={k.id} style={{ justifyContent: "flex-start", gap: "14px" }}>
                    {module?.image ? (
                      <img src={module.image} alt="" width={44} height={44} style={{ flexShrink: 0, borderRadius: "10px" }} />
                    ) : (
                      <span style={{ fontSize: "28px", flexShrink: 0 }}>{module?.icon || <IconEcran className="gozly-icon" />}</span>
                    )}
                    <div className="admin-row-main" style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div className="admin-row-title">{k.nom}</div>
                      <div className="admin-row-sub">{k.description}</div>
                    </div>
                    <div className="admin-row-controls">
                      <Link href={k.href} target="_blank" className="submit-btn" style={{ textDecoration: "none" }}>
                        <IconEcran className="gozly-icon" /> Ouvrir
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
