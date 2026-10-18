"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ClientsSection from "@/components/admin/ClientsSection";
import AdminsSection from "@/components/admin/AdminsSection";
import DiscordSection from "@/components/admin/DiscordSection";
import SupportSection from "@/components/admin/SupportSection";
import AnnoncesSiteSection from "@/components/admin/AnnoncesSiteSection";
import { IconBouclier, IconDiscord, IconFlecheGauche, IconMegaphone, IconMessage, IconProfils } from "@/components/icons/Pictogrammes";

const TABS = [
  { id: "clients", label: "Clients", Icone: IconProfils },
  { id: "support", label: "Support", Icone: IconMessage },
  { id: "annonces", label: "Annonces", Icone: IconMegaphone },
  { id: "discord", label: "Discord", Icone: IconDiscord },
  { id: "admins", label: "Équipe admin", Icone: IconBouclier },
];

// Onglets qui ouvrent un sous-menu : la barre latérale glisse vers un second niveau (avec « Retour »).
const SOUS_MENUS = {
  support: [
    { id: "tickets", label: "Tickets" },
    { id: "contact", label: "Formulaire de contact" },
  ],
  discord: [
    { id: "annonces", label: "Messages" },
    { id: "votes", label: "Référendums" },
    { id: "bot", label: "Bot" },
  ],
};

export default function AdminContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState(null);
  const [activeTab, setActiveTab] = useState("clients");
  const [vue, setVue] = useState("principal"); // "principal" ou le nom d'un onglet à sous-menu
  const [sous, setSous] = useState(null);
  const [sens, setSens] = useState("avant"); // sens de l'animation de la barre latérale
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
        <div key={vue} className={`admin-nav-niveau ${sens}`}>
          {vue === "principal" ? (
            TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`settings-nav-item${activeTab === tab.id ? " active" : ""}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (SOUS_MENUS[tab.id]) {
                    setSens("avant");
                    setVue(tab.id);
                    setSous(SOUS_MENUS[tab.id][0].id);
                  }
                }}
              >
                <span className="icon">{tab.Icone ? <tab.Icone className="gozly-icon" /> : tab.icon}</span> {tab.label}
                {tab.id === "support" && ticketsOuverts > 0 && <span className="admin-badge">{ticketsOuverts}</span>}
              </button>
            ))
          ) : (
            <>
              <button
                type="button"
                className="settings-nav-item admin-nav-retour"
                onClick={() => {
                  setSens("retour");
                  setVue("principal");
                  setActiveTab("clients");
                }}
              >
                <span className="icon">
                  <IconFlecheGauche className="gozly-icon" />
                </span>{" "}
                Retour
              </button>
              <div className="admin-nav-titre">{TABS.find((t) => t.id === vue)?.label}</div>
              {SOUS_MENUS[vue].map((item) => (
                <button key={item.id} type="button" className={`settings-nav-item${sous === item.id ? " active" : ""}`} onClick={() => setSous(item.id)}>
                  {item.label}
                  {vue === "support" && item.id === "tickets" && ticketsOuverts > 0 && <span className="admin-badge">{ticketsOuverts}</span>}
                </button>
              ))}
            </>
          )}
        </div>
      </nav>

      <div className="settings-panel">
        {activeTab === "clients" && <ClientsSection />}
        {activeTab === "support" && <SupportSection sous={sous} />}
        {activeTab === "annonces" && <AnnoncesSiteSection />}
        {activeTab === "discord" && <DiscordSection sous={sous} />}
        {activeTab === "admins" && <AdminsSection currentEmail={email} />}
      </div>
    </div>
  );
}
