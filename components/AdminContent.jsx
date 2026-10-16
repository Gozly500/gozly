"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ClientsSection from "@/components/admin/ClientsSection";
import AdminsSection from "@/components/admin/AdminsSection";
import DemandesContactSection from "@/components/admin/DemandesContactSection";
import DiscordSection from "@/components/admin/DiscordSection";
import { IconBouclier, IconEnveloppe, IconMessage, IconProfils } from "@/components/icons/Pictogrammes";

const TABS = [
  { id: "clients", label: "Clients", Icone: IconProfils },
  { id: "demandes", label: "Demandes", Icone: IconEnveloppe },
  { id: "discord", label: "Discord", Icone: IconMessage },
  { id: "admins", label: "Équipe admin", Icone: IconBouclier },
];

export default function AdminContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState(null);
  const [activeTab, setActiveTab] = useState("clients");
  const [ticketsOuverts, setTicketsOuverts] = useState(0);

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

  // Pastille : nombre de tickets Discord ouverts (rafraîchie chaque minute).
  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    async function compter() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch("/api/admin/tickets", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!ignore) setTicketsOuverts((json.tickets || []).filter((t) => !t.ferme).length);
      } catch {}
    }
    compter();
    const id = setInterval(compter, 60000);
    return () => {
      ignore = true;
      clearInterval(id);
    };
  }, [isAdmin]);

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
          <Link href="/dashboard" style={{ textDecoration: "underline", color: "var(--fg)" }}>
            Retourner au tableau de bord
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="wrap settings-wrap admin-wrap">
      <nav className="settings-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`settings-nav-item${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="icon">{tab.Icone ? <tab.Icone className="gozly-icon" /> : tab.icon}</span> {tab.label}
            {tab.id === "discord" && ticketsOuverts > 0 && <span className="admin-badge">{ticketsOuverts}</span>}
          </button>
        ))}
      </nav>

      <div className="settings-panel">
        {activeTab === "clients" && <ClientsSection />}
        {activeTab === "demandes" && <DemandesContactSection />}
        {activeTab === "discord" && <DiscordSection ticketsOuverts={ticketsOuverts} />}
        {activeTab === "admins" && <AdminsSection currentEmail={email} />}
      </div>
    </div>
  );
}
