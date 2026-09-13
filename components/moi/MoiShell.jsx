"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { employeFetch, getEmployeToken, clearEmployeToken } from "@/lib/employeAuth";
import { IconHoraire, IconDiscussion, IconDemande, IconMenu, IconTemperature } from "@/components/icons/GozlyIcons";

const ONGLETS_PRINCIPAUX = [
  { id: "horaire", label: "Horaire", Icone: IconHoraire, href: "/moi/horaire" },
  { id: "demandes", label: "Demandes", Icone: IconDemande, href: "/moi/demandes" },
  { id: "discussion", label: "Discussion", Icone: IconDiscussion, href: "/moi/discussion" },
];

// Pages secondaires, regroupées derrière le bouton "Menu" de la barre du
// bas plutôt que d'avoir un onglet chacune.
const ONGLETS_MENU = [
  { id: "taches", label: "Tâches", icon: "✅", href: "/moi/taches", module: "planning" },
  { id: "temperature", label: "Températures", Icone: IconTemperature, href: "/moi/temperature", module: "temperature" },
];

export default function MoiShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [moi, setMoi] = useState(null);
  const [menuOuvert, setMenuOuvert] = useState(false);

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
  const ongletsMenu = ONGLETS_MENU.filter((o) => !o.module || modulesActifs.includes(o.module));
  const estDiscussion = pathname === "/moi/discussion";
  const menuActif = ongletsMenu.some((o) => o.href === pathname);

  function allerA(href) {
    setMenuOuvert(false);
    router.push(href);
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

      <main className={`moi-main${estDiscussion ? " moi-main-chat" : ""}`}>{children}</main>

      <nav className="moi-tabbar">
        {ONGLETS_PRINCIPAUX.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`moi-tab${pathname === o.href ? " active" : ""}`}
            onClick={() => allerA(o.href)}
          >
            <span className="moi-tab-icon">{o.Icone ? <o.Icone className="gozly-icon" /> : o.icon}</span>
            <span>{o.label}</span>
          </button>
        ))}
        {ongletsMenu.length > 0 && (
          <button
            type="button"
            className={`moi-tab${menuActif ? " active" : ""}`}
            onClick={() => setMenuOuvert(true)}
          >
            <span className="moi-tab-icon">
              <IconMenu className="gozly-icon" />
            </span>
            <span>Menu</span>
          </button>
        )}
      </nav>

      {menuOuvert && (
        <div className="modal-overlay" onClick={() => setMenuOuvert(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Menu</h3>
              <button className="admin-icon-btn" onClick={() => setMenuOuvert(false)}>
                Fermer
              </button>
            </div>
            <div className="dash-nav">
              {ongletsMenu.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`dash-nav-item${pathname === o.href ? " active" : ""}`}
                  onClick={() => allerA(o.href)}
                >
                  {o.Icone ? <o.Icone className="gozly-icon" /> : <span>{o.icon}</span>} {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
