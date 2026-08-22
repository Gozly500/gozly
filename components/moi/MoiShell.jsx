"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { employeFetch, getEmployeToken, clearEmployeToken } from "@/lib/employeAuth";

const ONGLETS = [
  { id: "horaire", label: "Horaire", icon: "🗓", href: "/moi/horaire" },
  { id: "discussion", label: "Discussion", icon: "💬", href: "/moi/discussion" },
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

      <main className="moi-main">{children}</main>

      <nav className="moi-tabbar">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`moi-tab${pathname === o.href ? " active" : ""}${!o.href ? " disabled" : ""}`}
            onClick={() => o.href && router.push(o.href)}
            disabled={!o.href}
          >
            <span className="moi-tab-icon">{o.icon}</span>
            <span>{o.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
