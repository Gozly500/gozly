"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive, getImpersonation, arreterImpersonation } from "@/lib/entreprise";
import { PERMISSIONS } from "@/lib/permissions";
import { IconTableauDeBord, IconPlanning, IconHoraire, IconCommandes, IconDemande, IconDiscussion, IconMenu, IconMusique } from "@/components/icons/GozlyIcons";
import { useT } from "@/components/LangProvider";
import PastilleOnglets from "@/components/PastilleOnglets";

const GestionContexte = createContext(null);
export function useGestion() {
  return useContext(GestionContexte);
}

const PERMISSIONS_FEUILLE = ["voir_feuille_temps", "corriger_feuille_temps", "approuver_feuille_temps", "exporter_feuille_temps"];

// Cadre de l'app mobile du gestionnaire (/gestion) : connexion, entreprise active,
// permissions, modules actifs, en-tête et barre d'onglets du bas. Les pages
// s'affichent dedans et lisent l'état avec useGestion().
export default function GestionShell({ actif, children }) {
  const { t } = useT();
  const router = useRouter();
  const [pret, setPret] = useState(false);
  const [user, setUser] = useState(null);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [entrepriseNom, setEntrepriseNom] = useState("");
  const [plusieursEntreprises, setPlusieursEntreprises] = useState(false);
  const [modulesActifs, setModulesActifs] = useState([]);
  const [mesPermissions, setMesPermissions] = useState(null); // null = propriétaire (tout permis)
  const [menuOuvert, setMenuOuvert] = useState(false); // fenêtre des autres modules
  const [impersonation, setImpersonation] = useState(null); // mode admin : on regarde l'entreprise d'un client

  useEffect(() => {
    let ignore = false;
    setImpersonation(getImpersonation());

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace("/login?retour=/gestion");
        return;
      }
      if (ignore) return;
      setUser(session.user);

      const { entrepriseId: eid, entreprises, besoinChoix, invitationsEnAttente } = await resoudreEntrepriseActive(supabase);
      if (ignore) return;
      if (invitationsEnAttente > 0) {
        router.replace("/invitations");
        return;
      }
      if (besoinChoix) {
        router.replace("/dashboards?retour=/gestion");
        return;
      }
      setPlusieursEntreprises((entreprises || []).length > 1);
      setEntrepriseId(eid);
      if (!eid) {
        setPret(true);
        return;
      }

      const [{ data: ent }, { data: actifs }, { data: membre }] = await Promise.all([
        supabase.from("entreprises").select("nom").eq("id", eid).maybeSingle(),
        supabase.from("modules_actifs").select("module").eq("entreprise_id", eid),
        supabase.from("membres").select("id, role").eq("entreprise_id", eid).eq("user_id", session.user.id).maybeSingle(),
      ]);
      if (ignore) return;
      setEntrepriseNom(ent?.nom || "");
      setModulesActifs((actifs || []).map((a) => a.module));

      if (!membre || membre.role === "proprietaire") {
        setMesPermissions(null);
      } else {
        const { data: perms } = await supabase.from("membre_permissions").select("permission").eq("membre_id", membre.id);
        if (ignore) return;
        setMesPermissions((perms || []).map((p) => p.permission));
      }
      setPret(true);
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  function quitterModeAdmin() {
    arreterImpersonation();
    router.push("/admin");
  }

  async function deconnexion() {
    await supabase.auth.signOut();
    router.replace("/login?retour=/gestion");
  }

  if (!pret) {
    return (
      <div className="moi-shell">
        <p style={{ color: "var(--text-dim)", textAlign: "center", padding: "120px 20px" }}>{t("Chargement...")}</p>
      </div>
    );
  }

  const a = (permission) => mesPermissions === null || mesPermissions.includes(permission);
  const peutVoirFeuille = mesPermissions === null || PERMISSIONS_FEUILLE.some((p) => mesPermissions.includes(p));
  const horaireActif = modulesActifs.includes("horaire");
  const commandesActif = modulesActifs.includes("commandes");
  const tachesActif = modulesActifs.includes("planning");
  const musiqueActif = modulesActifs.includes("musique");

  const onglets = [
    { id: "accueil", href: "/gestion", label: "Accueil", Icone: IconTableauDeBord, visible: true },
    { id: "taches", href: "/gestion/taches", label: "Tâches", Icone: IconPlanning, visible: tachesActif },
    { id: "horaire", href: "/gestion/horaire", label: "Horaire", Icone: IconHoraire, visible: horaireActif },
    { id: "commandes", href: "/gestion/commandes", label: "Commandes", Icone: IconCommandes, visible: commandesActif },
    { id: "musique", href: "/gestion/musique", label: "Musique", Icone: IconMusique, visible: musiqueActif },
    { id: "demandes", href: "/gestion/demandes", label: "Demandes", Icone: IconDemande, visible: horaireActif },
    { id: "discussion", href: "/gestion/discussion", label: "Discussion", Icone: IconDiscussion, visible: true },
  ].filter((o) => o.visible);

  // Barre du bas : Accueil, Demandes, Discussion + Menu (Tâches, Horaire, Commandes...).
  const IDS_PRINCIPAUX = ["accueil", "demandes", "discussion"];
  const ongletsPrincipaux = IDS_PRINCIPAUX.map((id) => onglets.find((o) => o.id === id)).filter(Boolean);
  const ongletsMenu = onglets.filter((o) => !IDS_PRINCIPAUX.includes(o.id));
  const menuActif = ongletsMenu.some((o) => o.id === actif);
  // Pastille de la barre en pilule : position de l'onglet actif (les onglets principaux, puis « Menu »).
  const nbOnglets = ongletsPrincipaux.length + (ongletsMenu.length > 0 ? 1 : 0);
  let indexActif = ongletsPrincipaux.findIndex((o) => o.id === actif);
  if (indexActif < 0 && menuActif) indexActif = ongletsPrincipaux.length;

  const contexte = { user, entrepriseId, entrepriseNom, modulesActifs, mesPermissions, a, peutVoirFeuille, onglets };

  return (
    <GestionContexte.Provider value={contexte}>
      <div className={`moi-shell${actif === "discussion" ? " moi-shell-chat" : ""}`}>
        <header className="moi-header">
          <Link href="/gestion" className="moi-header-identite" style={{ textDecoration: "none" }}>
            <div className="moi-header-nom">{entrepriseNom || t("Gozly")}</div>
            <div className="moi-header-entreprise">{t("Gestion")}</div>
          </Link>
          <div className="moi-header-actions">
            {plusieursEntreprises && (
              <Link href="/dashboards?retour=/gestion" className="admin-icon-btn">
                {t("Changer")}
              </Link>
            )}
            <button type="button" className="admin-icon-btn" onClick={deconnexion}>
              {t("Déconnexion")}
            </button>
          </div>
        </header>

        {impersonation && (
          <div className="impersonation-banner" style={{ margin: 0, borderRadius: 0 }}>
            <div>
              <strong>{t("Mode admin")}</strong>
              <div>{impersonation.nom}</div>
            </div>
            <button type="button" onClick={quitterModeAdmin}>
              {t("Quitter")}
            </button>
          </div>
        )}

        <main className={`moi-main${actif === "discussion" ? " moi-main-chat" : ""}`}>
          {entrepriseId ? children : <p style={{ color: "var(--text-dim)" }}>{t("Aucune entreprise associée à ce compte.")}</p>}
        </main>

        {menuOuvert && <div className="moi-tabbar-fond" onClick={() => setMenuOuvert(false)} />}
        <nav className={`moi-tabbar${menuOuvert ? " ouvert" : ""}`}>
          {/* Le Menu déplie la pilule vers le haut au lieu d'ouvrir une fenêtre. */}
          <div className="moi-tabbar-deploye" aria-hidden={!menuOuvert}>
            <div className="moi-tabbar-deploye-int">
              {ongletsMenu.map((o) => (
                <Link
                  key={o.id}
                  href={o.href}
                  tabIndex={menuOuvert ? 0 : -1}
                  className={`moi-menu-item${actif === o.id ? " active" : ""}`}
                  onClick={() => setMenuOuvert(false)}
                >
                  <o.Icone className="gozly-icon" /> {t(o.label)}
                </Link>
              ))}
            </div>
          </div>
          <div className="moi-tabbar-rangee">
            <PastilleOnglets index={menuOuvert && ongletsMenu.length > 0 ? ongletsPrincipaux.length : indexActif} nb={nbOnglets} />
            {ongletsPrincipaux.map((o) => (
              <Link key={o.id} href={o.href} className={`moi-tab${!menuOuvert && actif === o.id ? " active" : ""}`} style={{ textDecoration: "none" }}>
                <span className="moi-tab-icon">
                  <o.Icone className="gozly-icon" />
                </span>
                <span>{t(o.label)}</span>
              </Link>
            ))}
            {ongletsMenu.length > 0 && (
              <button type="button" className={`moi-tab${menuOuvert || menuActif ? " active" : ""}`} aria-expanded={menuOuvert} onClick={() => setMenuOuvert((o) => !o)}>
                <span className="moi-tab-icon">
                  <IconMenu className="gozly-icon" />
                </span>
                <span>{t("Menu")}</span>
              </button>
            )}
          </div>
        </nav>
      </div>
    </GestionContexte.Provider>
  );
}
