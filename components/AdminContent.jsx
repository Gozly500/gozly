"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ClientsSection from "@/components/admin/ClientsSection";
import AdminsSection from "@/components/admin/AdminsSection";

const TABS = [
  { id: "clients", label: "Clients", icon: "👥" },
  { id: "admins", label: "Équipe admin", icon: "🛡" },
];

export default function AdminContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState(null);
  const [activeTab, setActiveTab] = useState("clients");

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      if (ignore) return;
      setEmail(session.user.email);

      const { data } = await supabase
        .from("admins")
        .select("id")
        .eq("email", session.user.email)
        .maybeSingle();

      if (ignore) return;
      setIsAdmin(!!data);
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

  if (!isAdmin) {
    return (
      <div className="wrap admin-denied">
        <h1>Accès refusé</h1>
        <p>Ce compte n'a pas accès au panneau admin.</p>
        <p style={{ marginTop: "18px" }}>
          <Link href="/dashboard" style={{ textDecoration: "underline", color: "#fff" }}>
            Retourner au tableau de bord
          </Link>
        </p>
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
        {activeTab === "clients" && <ClientsSection />}
        {activeTab === "admins" && <AdminsSection currentEmail={email} />}
      </div>
    </div>
  );
}
