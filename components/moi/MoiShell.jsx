"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { employeFetch, getEmployeToken, clearEmployeToken } from "@/lib/employeAuth";
import { IconHoraire, IconDiscussion, IconDemande } from "@/components/icons/GozlyIcons";

const ONGLETS = [
  { id: "horaire", label: "Horaire", Icone: IconHoraire, href: "/moi/horaire" },
  { id: "taches", label: "Tâches", icon: "✅", href: "/moi/taches", module: "planning" },
  { id: "demandes", label: "Demandes", Icone: IconDemande, href: "/moi/demandes" },
  { id: "discussion", label: "Discussion", Icone: IconDiscussion, href: "/moi/discussion" },
];

export default function MoiShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [moi, setMoi] = useState(null);

  useEffect(() => {
    const token = getEmployeToken();
    if (!token) {
      router.push("/moi/connexion");
      return;
    }

    employeFetch("/api/employe-app/moi").then(async (res) => {
      if (!res.ok) {
        clearEmployeToken();
        router.push("/moi/connexion");
        return;
      }
      setMoi(await res.json());
      setChecking(false);
    });
  }, [router]);

  async function handleLogout() {
    await employeFetch("/api/employe-app/deconnexion", { method: "POST" });
    clearEmployeToken();
    router.push("/moi/connexion");
  }

  if (checking) {
    return (
      <div className="moi-loading">
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  const modulesActifs = moi?.modulesActifs || [];
  const onglets = ONGLETS.filter((o) => !o.module || modulesActifs.includes(o.module));
  const estDiscussion = pathname === "/moi/discussion";

  return (
    <div className="moi-shell">
      <header className="moi-header">
        <div>
          <div className="moi-header-nom">{moi?.employe?.nom}</div>
          <div className="moi-header-entreprise">{moi?.entreprise?.nom}</div>
        </div>
        <button type="button" className="admin-icon-btn" onClick={handleLogout}>
          Déconnexion
        </button>
      </header>

      <main className={`moi-main${estDiscussion ? " moi-main-chat" : ""}`}>{children}</main>

      <nav className="moi-tabbar">
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`moi-tab${pathname === o.href ? " active" : ""}${!o.href ? " disabled" : ""}`}
            onClick={() => o.href && router.push(o.href)}
            disabled={!o.href}
          >
            <span className="moi-tab-icon">{o.Icone ? <o.Icone className="gozly-icon" /> : o.icon}</span>
            <span>{o.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
