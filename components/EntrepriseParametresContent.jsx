"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashSidebar from "@/components/DashSidebar";
import InformationsEntrepriseSection from "@/components/entreprise/InformationsEntrepriseSection";
import EquipeSection from "@/components/entreprise/EquipeSection";
import EmplacementsSection from "@/components/entreprise/EmplacementsSection";
import PersonnalisationSection, { MODULES_PERSONNALISATION } from "@/components/entreprise/PersonnalisationSection";
import IntegrationsSection from "@/components/settings/IntegrationsSection";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { IconEquipe, IconEmplacement, IconIntegration } from "@/components/icons/GozlyIcons";
import { IconFlecheBas, IconFlecheGauche, IconPalette, IconProfil } from "@/components/icons/Pictogrammes";
import { useT } from "@/components/LangProvider";

const TABS = [
  { id: "informations", label: "Informations", Icone: IconProfil },
  { id: "equipe", label: "Équipe", Icone: IconEquipe },
  { id: "emplacements", label: "Emplacements", Icone: IconEmplacement },
  { id: "personnalisation", label: "Personnalisation", Icone: IconPalette },
  { id: "integrations", label: "Intégrations", Icone: IconIntegration },
];

export default function EntrepriseParametresContent() {
  const { t } = useT();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [activeTab, setActiveTab] = useState("informations");
  // Personnalisation : la barre latérale glisse vers un second niveau (modules, puis catégories de réglages du module ouvert).
  const [vue, setVue] = useState("principal"); // "principal" | "personnalisation"
  const [sens, setSens] = useState("avant"); // sens de l'animation de la barre latérale
  const [modulesActifs, setModulesActifs] = useState([]);
  const [moduleChoisi, setModuleChoisi] = useState(null);
  const [categorieChoisie, setCategorieChoisie] = useState(null);

  // Retour d'une connexion externe (ex: OneDrive) : l'adresse peut demander d'ouvrir directement un onglet (?onglet=integrations).
  useEffect(() => {
    const onglet = new URLSearchParams(window.location.search).get("onglet");
    if (TABS.some((tab) => tab.id === onglet)) setActiveTab(onglet);
  }, []);

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      if (ignore) return;
      setUser(session.user);

      supabase
        .from("admins")
        .select("id")
        .eq("email", session.user.email)
        .maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));

      const { entrepriseId: eid, entreprises, besoinChoix, invitationsEnAttente, impersonation } =
        await resoudreEntrepriseActive(supabase);
      if (ignore) return;

      if (invitationsEnAttente > 0) {
        router.push("/invitations");
        return;
      }

      if (besoinChoix) {
        router.push("/dashboards");
        return;
      }

      // Compte tout neuf, sans aucune entreprise : le formulaire de création
      // (logo, secteur, adresse, etc.) est plus complet là qu'ici, donc on y
      // redirige plutôt que d'afficher une page vide.
      if (!impersonation && entreprises.length === 0) {
        router.push("/bienvenue");
        return;
      }

      setEntrepriseId(eid);
      setChecking(false);
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  // Modules actifs de l'entreprise : ce sont eux qui apparaissent dans la barre latérale de Personnalisation.
  useEffect(() => {
    if (!entrepriseId) return;
    let ignore = false;
    supabase
      .from("modules_actifs")
      .select("module")
      .eq("entreprise_id", entrepriseId)
      .then(({ data }) => {
        if (!ignore) setModulesActifs((data || []).map((m) => m.module));
      });
    return () => {
      ignore = true;
    };
  }, [entrepriseId]);

  const modulesPerso = MODULES_PERSONNALISATION.filter((m) => modulesActifs.includes(m.id));

  // En entrant dans Personnalisation (ou si le module choisi n'existe plus), on ouvre le premier module et sa première catégorie.
  useEffect(() => {
    if (vue !== "personnalisation" || modulesPerso.length === 0) return;
    if (!modulesPerso.some((m) => m.id === moduleChoisi)) {
      setModuleChoisi(modulesPerso[0].id);
      setCategorieChoisie(modulesPerso[0].categories[0].id);
    }
  }, [vue, modulesPerso.map((m) => m.id).join(","), moduleChoisi]);

  // Sur mobile la barre est une ligne qui défile : on garde le choix en vue.
  useEffect(() => {
    if (vue !== "personnalisation" || window.innerWidth > 820) return;
    document.querySelector(".settings-nav .param-nav-sous-item.active, .settings-nav .settings-nav-item.active")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [vue, moduleChoisi, categorieChoisie]);

  function choisirModule(m) {
    if (moduleChoisi === m.id) return; // déjà ouvert : on garde la catégorie en cours
    setModuleChoisi(m.id);
    setCategorieChoisie(m.categories[0].id);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (checking) {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>{t("Chargement...")}</p>
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.entreprise || user?.email;

  return (
    <div className="dash-layout">
      <DashSidebar
        active="entreprise"
        displayName={displayName}
        userEmail={user?.email}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        entrepriseId={entrepriseId}
      />

      <main className="dash-main">
        <div className="dash-main-inner">
          {!entrepriseId ? (
            <p style={{ color: "var(--text-dim)" }}>{t("Aucune entreprise associée à ce compte.")}</p>
          ) : (
            <div className="settings-wrap" style={{ maxWidth: "none", padding: 0 }}>
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
                          if (tab.id === "personnalisation") {
                            setSens("avant");
                            setVue("personnalisation");
                          }
                        }}
                      >
                        <span className="icon">{tab.Icone ? <tab.Icone className="gozly-icon" /> : tab.icon}</span> {t(tab.label)}
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
                          setActiveTab("informations");
                        }}
                      >
                        <span className="icon">
                          <IconFlecheGauche className="gozly-icon" />
                        </span>{" "}
                        {t("Retour")}
                      </button>
                      <div className="admin-nav-titre">{t("Personnalisation")}</div>
                      {modulesPerso.map((m) => {
                        const ouvert = moduleChoisi === m.id;
                        const plusieurs = m.categories.length > 1;
                        return (
                          <div key={m.id} className="param-nav-groupe">
                            <button
                              type="button"
                              className={`settings-nav-item${ouvert ? (plusieurs ? " param-nav-ouvert" : " active") : ""}`}
                              aria-expanded={plusieurs ? ouvert : undefined}
                              onClick={() => choisirModule(m)}
                            >
                              <span className="param-nav-libelle">{t(m.label)}</span>
                              {plusieurs && (
                                <span className={`param-nav-fleche${ouvert ? " ouvert" : ""}`}>
                                  <IconFlecheBas className="gozly-icon-inline" />
                                </span>
                              )}
                            </button>
                            {plusieurs && (
                              <div className={`param-nav-sous${ouvert ? " ouvert" : ""}`} aria-hidden={!ouvert}>
                                <div className="param-nav-sous-int">
                                  {m.categories.map((c) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      tabIndex={ouvert ? 0 : -1}
                                      className={`settings-nav-item param-nav-sous-item${ouvert && categorieChoisie === c.id ? " active" : ""}`}
                                      onClick={() => {
                                        setModuleChoisi(m.id);
                                        setCategorieChoisie(c.id);
                                      }}
                                    >
                                      {t(c.label)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {modulesPerso.length === 0 && <p className="section-hint" style={{ padding: "0 14px" }}>{t("Aucun module actif.")}</p>}
                    </>
                  )}
                </div>
              </nav>

              <div className="settings-panel">
                {activeTab === "informations" && (
                  <InformationsEntrepriseSection entrepriseId={entrepriseId} userId={user?.id} />
                )}
                {activeTab === "equipe" && (
                  <EquipeSection entrepriseId={entrepriseId} userId={user?.id} onLeft={() => router.push("/dashboards")} />
                )}
                {activeTab === "emplacements" && <EmplacementsSection entrepriseId={entrepriseId} />}
                {activeTab === "personnalisation" && <PersonnalisationSection entrepriseId={entrepriseId} module={moduleChoisi} categorie={categorieChoisie} />}
                {activeTab === "integrations" && <IntegrationsSection entrepriseId={entrepriseId} />}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
