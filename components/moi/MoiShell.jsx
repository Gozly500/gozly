"use client";

import { useCallback, useEffect, useState } from "react";
import PastilleOnglets from "@/components/PastilleOnglets";
import ChargementAnimation from "@/components/moi/ChargementAnimation";
import { usePathname, useRouter } from "next/navigation";
import { employeFetch, getEmployeToken, clearEmployeToken } from "@/lib/employeAuth";
import { IconHoraire, IconDiscussion, IconDemande, IconMenu, IconTemperature, IconPlanning, IconCommandes } from "@/components/icons/GozlyIcons";
import { IconEngrenage } from "@/components/icons/Pictogrammes";
import MoiChargement from "@/components/moi/MoiChargement";
import { repareAbonnementPush } from "@/components/moi/NotificationsPush";
import AnnoncesBandeau from "@/components/moi/AnnoncesBandeau";
import ClocheAnnonces from "@/components/moi/ClocheAnnonces";
import { AnnoncesProvider } from "@/components/moi/AnnoncesContext";
import { useLangue } from "@/components/moi/LangueContext";
import PastilleMessages from "@/components/moi/PastilleMessages";
import Avatar from "@/components/Avatar";

// L'accueil n'est pas un onglet: on y retourne en appuyant sur son nom
// en haut à gauche (voir le <header> plus bas).
const ONGLETS_PRINCIPAUX = [
  { id: "horaire", cle: "nav.horaire", Icone: IconHoraire, href: "/moi/horaire" },
  { id: "demandes", cle: "nav.demandes", Icone: IconDemande, href: "/moi/demandes" },
  { id: "discussion", cle: "nav.discussion", Icone: IconDiscussion, href: "/moi/discussion" },
];

// Pages secondaires, regroupées derrière le bouton "Menu" de la barre du
// bas plutôt que d'avoir un onglet chacune.
const ONGLETS_MENU = [
  { id: "taches", cle: "nav.taches", Icone: IconPlanning, href: "/moi/taches", module: "planning" },
  { id: "temperature", cle: "nav.temperature", Icone: IconTemperature, href: "/moi/temperature", module: "temperature" },
  { id: "commandes", cle: "nav.commandes", Icone: IconCommandes, href: "/moi/commandes", module: "commandes" },
];

// MoiShell remonte à chaque changement de page (chaque route sous /moi a
// son propre page.js qui l'instancie) - l'animation d'ouverture ne doit
// jouer qu'une fois par session, pas à chaque changement d'onglet.
const CLE_SPLASH_VU = "gozly_moi_splash_vu";

// Réponse de /api/employe-app/moi gardée en mémoire d'une page à l'autre (le module survit aux navigations) : en changeant d'onglet,
// l'app s'affiche tout de suite avec ces données et les rafraîchit en arrière-plan, au lieu de repasser par un écran de chargement.
let moiEnMemoire = null;

export default function MoiShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLangue();
  const [checking, setChecking] = useState(!moiEnMemoire);
  const [moi, setMoi] = useState(moiEnMemoire);
  const [menuOuvert, setMenuOuvert] = useState(false);
  // Démarre à false des deux côtés (serveur et client) pour éviter un
  // mismatch d'hydratation - sessionStorage n'existe pas côté serveur.
  const [afficherSplash, setAfficherSplash] = useState(false);
  const [animationTerminee, setAnimationTerminee] = useState(false);
  const marquerAnimationTerminee = useCallback(() => setAnimationTerminee(true), []);

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
        moiEnMemoire = null;
        router.push("/moi/connexion");
        return;
      }
      const donnees = await res.json();
      moiEnMemoire = donnees;
      setMoi(donnees);
      setChecking(false);
      repareAbonnementPush(); // récupère en silence un abonnement push perdu (voir NotificationsPush.jsx)
    });
  }, [router]);

  const modulesActifs = moi?.modulesActifs || [];
  const ongletsMenu = ONGLETS_MENU.filter((o) => !o.module || modulesActifs.includes(o.module));
  const estDiscussion = pathname === "/moi/discussion";
  const menuActif = ongletsMenu.some((o) => o.href === pathname);

  // Index de l'onglet actif dans la barre (les onglets principaux, puis « Menu » s'il y en a un) ; -1 = aucun (page hors barre).
  const nbOnglets = ONGLETS_PRINCIPAUX.length + (ongletsMenu.length > 0 ? 1 : 0);
  let indexActif = ONGLETS_PRINCIPAUX.findIndex((o) => pathname === o.href);
  if (indexActif < 0 && menuActif && ongletsMenu.length > 0) indexActif = ONGLETS_PRINCIPAUX.length;

  // Si le splash joue, on garde l'app cachée jusqu'à ce qu'il soit fini
  // (même si les données ont fini de charger avant), pour ne pas couper
  // l'animation en plein milieu.
  if (checking || (afficherSplash && !animationTerminee)) {
    return afficherSplash ? (
      <MoiChargement onTermine={marquerAnimationTerminee} />
    ) : (
      <div className="moi-loading">
        <ChargementAnimation />
      </div>
    );
  }

  function allerA(href) {
    setMenuOuvert(false);
    router.push(href);
  }

  return (
    <AnnoncesProvider>
    <div className={`moi-shell${estDiscussion ? " moi-shell-chat" : ""}`}>
      <header className="moi-header">
        <button type="button" className="moi-header-identite" onClick={() => router.push("/moi/accueil")}>
          <Avatar valeur={moi?.employe?.avatar} nom={moi?.employe?.nom} taille={40} />
          <span className="moi-header-identite-textes">
            <div className="moi-header-nom">{moi?.employe?.nom}</div>
            <div className="moi-header-entreprise">{moi?.entreprise?.nom}</div>
          </span>
        </button>
        <div className="moi-header-actions">
          <button
            type="button"
            className="admin-icon-btn moi-header-icon-btn"
            onClick={() => router.push("/moi/parametres")}
            aria-label={t("nav.parametres")}
          >
            <IconEngrenage className="gozly-icon" />
          </button>
          <ClocheAnnonces />
        </div>
      </header>

      <AnnoncesBandeau />

      <main className={`moi-main${estDiscussion ? " moi-main-chat" : ""}`}>{children}</main>

      {menuOuvert && <div className="moi-tabbar-fond" onClick={() => setMenuOuvert(false)} />}
      <nav className={`moi-tabbar${menuOuvert ? " ouvert" : ""}`}>
        {/* Le Menu déplie la pilule vers le haut au lieu d'ouvrir une fenêtre. */}
        <div className="moi-tabbar-deploye" aria-hidden={!menuOuvert}>
          <div className="moi-tabbar-deploye-int">
            {ongletsMenu.map((o) => (
              <button
                key={o.id}
                type="button"
                tabIndex={menuOuvert ? 0 : -1}
                className={`moi-menu-item${pathname === o.href ? " active" : ""}`}
                onClick={() => allerA(o.href)}
              >
                {o.Icone ? <o.Icone className="gozly-icon" /> : <span>{o.icon}</span>} {t(o.cle)}
              </button>
            ))}
          </div>
        </div>
        <div className="moi-tabbar-rangee">
          <PastilleOnglets index={menuOuvert && ongletsMenu.length > 0 ? ONGLETS_PRINCIPAUX.length : indexActif} nb={nbOnglets} />
          {ONGLETS_PRINCIPAUX.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`moi-tab${!menuOuvert && pathname === o.href ? " active" : ""}`}
              onClick={() => allerA(o.href)}
            >
              <span className="moi-tab-icon">
                {o.Icone ? <o.Icone className="gozly-icon" /> : o.icon}
                {o.id === "discussion" && <PastilleMessages />}
              </span>
              <span>{t(o.cle)}</span>
            </button>
          ))}
          {ongletsMenu.length > 0 && (
            <button
              type="button"
              className={`moi-tab${menuOuvert || menuActif ? " active" : ""}`}
              aria-expanded={menuOuvert}
              onClick={() => setMenuOuvert((o) => !o)}
            >
              <span className="moi-tab-icon">
                <IconMenu className="gozly-icon" />
              </span>
              <span>{t("nav.menu")}</span>
            </button>
          )}
        </div>
      </nav>
    </div>
    </AnnoncesProvider>
  );
}
