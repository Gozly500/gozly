"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { employeFetch, getEmployeToken, clearEmployeToken } from "@/lib/employeAuth";
import { IconHoraire, IconDiscussion, IconDemande, IconMenu, IconTemperature, IconTaches, IconParametres } from "@/components/icons/GozlyIcons";
import { DEFAULT_THEME, THEME_STORAGE_KEY_MOI, isValidTheme } from "@/lib/themes";
import MoiChargement from "@/components/moi/MoiChargement";

// L'accueil n'est pas un onglet: on y retourne en appuyant sur son nom
// en haut à gauche (voir le <header> plus bas).
const ONGLETS_PRINCIPAUX = [
  { id: "horaire", label: "Horaire", Icone: IconHoraire, href: "/moi/horaire" },
  { id: "demandes", label: "Demandes", Icone: IconDemande, href: "/moi/demandes" },
  { id: "discussion", label: "Discussion", Icone: IconDiscussion, href: "/moi/discussion" },
];

// Pages secondaires, regroupées derrière le bouton "Menu" de la barre du
// bas plutôt que d'avoir un onglet chacune.
const ONGLETS_MENU = [
  { id: "taches", label: "Tâches", Icone: IconTaches, href: "/moi/taches", module: "planning" },
  { id: "temperature", label: "Températures", Icone: IconTemperature, href: "/moi/temperature", module: "temperature" },
];

// MoiShell remonte à chaque changement de page (chaque route sous /moi a
// son propre page.js qui l'instancie) - l'animation d'ouverture ne doit
// jouer qu'une fois par session, pas à chaque changement d'onglet.
const CLE_SPLASH_VU = "gozly_moi_splash_vu";

export default function MoiShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [moi, setMoi] = useState(null);
  const [menuOuvert, setMenuOuvert] = useState(false);
  // Démarre à false des deux côtés (serveur et client) pour éviter un
  // mismatch d'hydratation - sessionStorage n'existe pas côté serveur.
  const [afficherSplash, setAfficherSplash] = useState(false);

  useEffect(() => {
    try {
      if (!window.sessionStorage.getItem(CLE_SPLASH_VU)) {
        window.sessionStorage.setItem(CLE_SPLASH_VU, "1");
        setAfficherSplash(true);
      }
    } catch {}
  }, []);

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

  // Thème choisi dans Paramètres (voir components/moi/ParametresEmploye.jsx),
  // gardé en localStorage sur l'appareil - pas de compte Supabase Auth côté
  // employé pour le persister en base.
  useEffect(() => {
    let theme = DEFAULT_THEME;
    try {
      const cached = window.localStorage.getItem(THEME_STORAGE_KEY_MOI);
      if (isValidTheme(cached)) theme = cached;
    } catch {}
    document.documentElement.dataset.theme = theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, []);

  async function handleLogout() {
    await employeFetch("/api/employe-app/deconnexion", { method: "POST" });
    clearEmployeToken();
    router.push("/moi/connexion");
  }

  if (checking) {
    return afficherSplash ? (
      <MoiChargement />
    ) : (
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
        <button type="button" className="moi-header-identite" onClick={() => router.push("/moi/accueil")}>
          <div className="moi-header-nom">{moi?.employe?.nom}</div>
          <div className="moi-header-entreprise">{moi?.entreprise?.nom}</div>
        </button>
        <div className="moi-header-actions">
          <button
            type="button"
            className="admin-icon-btn moi-header-icon-btn"
            onClick={() => router.push("/moi/parametres")}
            aria-label="Paramètres"
          >
            <IconParametres className="gozly-icon" />
          </button>
          <button type="button" className="admin-icon-btn" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
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
