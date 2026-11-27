"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGardeMfa } from "@/lib/useGardeMfa";
import { supabase } from "@/lib/supabaseClient";
import { MODULES, limiteModules, moduleAutorise } from "@/lib/modules";
import { useForfaits } from "@/lib/useForfaits";
import ModulesModal from "@/components/ModulesModal";
import BetaBadge from "@/components/BetaBadge";
import ForfaitBloqueModal from "@/components/ForfaitBloqueModal";
import { getImpersonation, arreterImpersonation } from "@/lib/entreprise";
import { PERMISSIONS } from "@/lib/permissions";
import {
  IconDiscussion,
  IconEmployes,
  IconPlanning,
  IconHoraire,
  IconInventaire,
  IconVentes,
  IconTemperature,
  IconCommandes,
  IconMusique,
} from "@/components/icons/GozlyIcons";
import { IconBouclier, IconCategorie, IconEchange, IconEngrenage, IconFlecheDroite, IconFlecheGauche, IconMaison } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";

const ICONES_MODULES = {
  planning: IconPlanning,
  horaire: IconHoraire,
  inventaire: IconInventaire,
  ventes: IconVentes,
  temperature: IconTemperature,
  commandes: IconCommandes,
  musique: IconMusique,
};

export default function DashSidebar({ active, displayName, userEmail, isAdmin, onLogout, entrepriseId }) {
  const { t } = useT();
  const router = useRouter();
  useGardeMfa();
  useForfaits();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [actifs, setActifs] = useState([]);
  const [forfait, setForfait] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [nomEntreprise, setNomEntreprise] = useState("");
  const [impersonation, setImpersonationState] = useState(null);
  // null = pas encore chargé (ou propriétaire/admin) - aucune restriction
  // cosmétique appliquée dans ce cas. La vraie barrière reste les policies RLS.
  const [mesPermissions, setMesPermissions] = useState(null);

  useEffect(() => {
    setImpersonationState(getImpersonation());
  }, [entrepriseId]);

  useEffect(() => {
    if (!entrepriseId) return;
    loadActifs();
  }, [entrepriseId]);

  useEffect(() => {
    if (!entrepriseId) return;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: membre } = await supabase
        .from("membres")
        .select("id, role")
        .eq("entreprise_id", entrepriseId)
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!membre || membre.role === "proprietaire") {
        setMesPermissions(null);
        return;
      }
      const { data: perms } = await supabase.from("membre_permissions").select("permission").eq("membre_id", membre.id);
      setMesPermissions((perms || []).map((p) => p.permission));
    });
  }, [entrepriseId]);

  const permissionsHoraire = PERMISSIONS.filter((p) => p.module === "horaire").map((p) => p.id);
  const peutVoirHoraire = !mesPermissions || permissionsHoraire.some((p) => mesPermissions.includes(p));

  function quitterImpersonation() {
    arreterImpersonation();
    router.push("/admin");
  }

  async function loadActifs() {
    const [{ data: modules }, { data: entreprise }] = await Promise.all([
      supabase.from("modules_actifs").select("module").eq("entreprise_id", entrepriseId),
      supabase.from("entreprises").select("forfait, nom").eq("id", entrepriseId).maybeSingle(),
    ]);
    setActifs((modules || []).map((m) => m.module));
    setForfait(entreprise?.forfait || null);
    setNomEntreprise(entreprise?.nom || "");
  }

  const modulesActifs = MODULES.filter((m) => actifs.includes(m.id));
  const limite = limiteModules(forfait);
  const nonInclus = actifs.filter((id) => !moduleAutorise(forfait, id));
  const forfaitDepasse = actifs.length > limite || nonInclus.length > 0;

  return (
    <>
      <button
        className={`dash-sidebar-tab${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label={t("Ouvrir le menu")}
      >
        {sidebarOpen ? <IconFlecheGauche className="gozly-icon" /> : <IconFlecheDroite className="gozly-icon" />}
      </button>

      <aside className={`dash-sidebar${sidebarOpen ? " open" : ""}`}>
        <Link href="/" className="dash-sidebar-logo">
          <img src="/gozly-logo-noel.svg" alt="" />
          <span>{t("Gozly")}</span>
        </Link>

        {impersonation && (
          <div className="impersonation-banner">
            <div>
              <strong>{t("Mode admin")}</strong>
              <div>{impersonation.nom}</div>
            </div>
            <button onClick={quitterImpersonation}>{t("Quitter")}</button>
          </div>
        )}

        <nav className="dash-nav">
          <Link href="/dashboard" className={`dash-nav-item${active === "dashboard" ? " active" : ""}`}>
            <IconMaison className="gozly-icon" />{" "}{t("Tableau de bord")}
          </Link>
          <Link href="/dashboard/discussion" className={`dash-nav-item${active === "discussion" ? " active" : ""}`}>
            <IconDiscussion className="gozly-icon" />{" "}{t("Discussion")}
          </Link>
          <Link href="/dashboard/entreprise/employes" className={`dash-nav-item${active === "employes" ? " active" : ""}`}>
            <IconEmployes className="gozly-icon" />{" "}{t("Employés")}
          </Link>
          <Link href="/dashboard/entreprise/parametres" className={`dash-nav-item${active === "entreprise" ? " active" : ""}`}>
            <IconEngrenage className="gozly-icon" />{" "}{t("Paramètres")}
          </Link>
          <div className="dash-nav-label">{t("Modules")}</div>
          {modulesActifs.filter((mod) => mod.id !== "horaire" || peutVoirHoraire).map((mod) => {
            const IconeModule = ICONES_MODULES[mod.id];
            return (
            <div key={mod.id}>
              <Link href={mod.href} className={`dash-nav-item${active === mod.id ? " active" : ""}`}>
                {IconeModule ? <IconeModule className="gozly-icon" /> : null} {t(mod.nom)}{mod.beta && <BetaBadge hauteur={13} />}
              </Link>
              {mod.id === "planning" && (active === "planning" || active === "categories") && (
                <Link
                  href="/dashboard/planning/categories"
                  className={`dash-nav-item dash-nav-sub${active === "categories" ? " active" : ""}`}
                >
                  <IconCategorie className="gozly-icon" />{" "}{t("Catégories")}
                </Link>
              )}
              {mod.id === "inventaire" && (active === "inventaire" || active === "inventaire-categories") && (
                <Link
                  href="/dashboard/inventaire/categories"
                  className={`dash-nav-item dash-nav-sub${active === "inventaire-categories" ? " active" : ""}`}
                >
                  <IconCategorie className="gozly-icon" />{" "}{t("Catégories")}
                </Link>
              )}
              {mod.id === "temperature" && (active === "temperature" || active === "temperature-equipements") && (
                <Link
                  href="/dashboard/temperature/equipements"
                  className={`dash-nav-item dash-nav-sub${active === "temperature-equipements" ? " active" : ""}`}
                >
                  <IconCategorie className="gozly-icon" />{" "}{t("Équipements")}
                </Link>
              )}
            </div>
            );
          })}
          {entrepriseId && (
            <button className="dash-nav-item dash-nav-manage" onClick={() => setModalOpen(true)}>
              <span>+</span>{" "}{t("Gérer les modules")}
            </button>
          )}
        </nav>

        <div className="dash-sidebar-user">
          <div className="dash-user-header">
            <div>
              <div className="dash-user-name">{displayName}</div>
              {displayName !== userEmail && <div className="dash-user-email">{userEmail}</div>}
            </div>
          </div>
          <div className="dash-user-actions">
            {isAdmin && (
              <Link href="/admin" className="dash-settings-btn" title={t("Panneau admin")}>
                <IconBouclier className="gozly-icon" />
              </Link>
            )}
            <Link href="/parametres" className="dash-settings-btn" title={t("Paramètres du compte")}>
              <IconEngrenage className="gozly-icon" />
            </Link>
            <button onClick={onLogout} className="dash-logout-btn">
              {t("Déconnexion")}
            </button>
          </div>
          {!impersonation && (
            <Link href="/dashboards" className="dash-switch-link" title={t("Changer de dashboard")}>
              <IconEchange className="gozly-icon" /> {nomEntreprise || t("Changer de dashboard")}
            </Link>
          )}
        </div>
      </aside>

      {modalOpen && !forfaitDepasse && (
        <ModulesModal
          entrepriseId={entrepriseId}
          onClose={() => setModalOpen(false)}
          onChange={loadActifs}
        />
      )}

      {forfaitDepasse && (
        <ForfaitBloqueModal
          entrepriseId={entrepriseId}
          actifs={actifs}
          forfait={forfait}
          limite={limite}
          onChange={loadActifs}
        />
      )}
    </>
  );
}
