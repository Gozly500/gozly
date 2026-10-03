"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive, getImpersonation, arreterImpersonation } from "@/lib/entreprise";
import { PERMISSIONS } from "@/lib/permissions";
import { IconTableauDeBord, IconHoraire, IconCommandes, IconDemande, IconDiscussion } from "@/components/icons/GozlyIcons";

const GestionContexte = createContext(null);
export function useGestion() {
  return useContext(GestionContexte);
}

const PERMISSIONS_FEUILLE = ["voir_feuille_temps", "corriger_feuille_temps", "approuver_feuille_temps", "exporter_feuille_temps"];

// Cadre de l'app mobile du gestionnaire (/gestion) : connexion, entreprise active,
// permissions, modules actifs, en-tête et barre d'onglets du bas. Les pages
// s'affichent dedans et lisent l'état avec useGestion().
export default function GestionShell({ actif, children }) {
  const router = useRouter();
  const [pret, setPret] = useState(false);
  const [user, setUser] = useState(null);
  const [entrepriseId, setEntrepriseId] = useState(null);
  const [entrepriseNom, setEntrepriseNom] = useState("");
  const [plusieursEntreprises, setPlusieursEntreprises] = useState(false);
  const [modulesActifs, setModulesActifs] = useState([]);
  const [mesPermissions, setMesPermissions] = useState(null); // null = propriétaire (tout permis)
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
        router.replace("/dashboards");
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
        <p style={{ color: "var(--text-dim)", textAlign: "center", padding: "120px 20px" }}>Chargement...</p>
      </div>
    );
  }

  const a = (permission) => mesPermissions === null || mesPermissions.includes(permission);
  const peutVoirFeuille = mesPermissions === null || PERMISSIONS_FEUILLE.some((p) => mesPermissions.includes(p));
  const horaireActif = modulesActifs.includes("horaire");
  const commandesActif = modulesActifs.includes("commandes");

  const onglets = [
    { id: "accueil", href: "/gestion", label: "Accueil", Icone: IconTableauDeBord, visible: true },
    { id: "horaire", href: "/gestion/horaire", label: "Horaire", Icone: IconHoraire, visible: horaireActif },
    { id: "commandes", href: "/gestion/commandes", label: "Commandes", Icone: IconCommandes, visible: commandesActif },
    { id: "demandes", href: "/gestion/demandes", label: "Demandes", Icone: IconDemande, visible: horaireActif },
    { id: "discussion", href: "/gestion/discussion", label: "Discussion", Icone: IconDiscussion, visible: true },
  ].filter((o) => o.visible);

  const contexte = { user, entrepriseId, entrepriseNom, modulesActifs, mesPermissions, a, peutVoirFeuille, onglets };

  return (
    <GestionContexte.Provider value={contexte}>
      <div className={`moi-shell${actif === "discussion" ? " moi-shell-chat" : ""}`}>
        <header className="moi-header">
          <Link href="/gestion" className="moi-header-identite" style={{ textDecoration: "none" }}>
            <div className="moi-header-nom">{entrepriseNom || "Gozly"}</div>
            <div className="moi-header-entreprise">Gestion</div>
          </Link>
          <div className="moi-header-actions">
            {plusieursEntreprises && (
              <Link href="/dashboards" className="admin-icon-btn">
                Changer
              </Link>
            )}
            <button type="button" className="admin-icon-btn" onClick={deconnexion}>
              Déconnexion
            </button>
          </div>
        </header>

        {impersonation && (
          <div className="impersonation-banner" style={{ margin: 0, borderRadius: 0 }}>
            <div>
              <strong>Mode admin</strong>
              <div>{impersonation.nom}</div>
            </div>
            <button type="button" onClick={quitterModeAdmin}>
              Quitter
            </button>
          </div>
        )}

        <main className={`moi-main${actif === "discussion" ? " moi-main-chat" : ""}`}>
          {entrepriseId ? children : <p style={{ color: "var(--text-dim)" }}>Aucune entreprise associée à ce compte.</p>}
        </main>

        <nav className="moi-tabbar">
          {onglets.map((o) => (
            <Link key={o.id} href={o.href} className={`moi-tab${actif === o.id ? " active" : ""}`} style={{ textDecoration: "none" }}>
              <span className="moi-tab-icon">
                <o.Icone className="gozly-icon" />
              </span>
              <span>{o.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </GestionContexte.Provider>
  );
}
