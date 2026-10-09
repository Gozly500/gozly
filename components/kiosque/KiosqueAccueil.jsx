"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { MODULES } from "@/lib/modules";
import { KIOSQUES } from "@/lib/kiosques";
import { IconEcran } from "@/components/icons/Pictogrammes";

function detecterIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function dejaInstallee() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

// Page d'accueil de l'app tablette : installation (si pas encore installée), connexion au
// compte Gozly, puis la liste des kiosques des modules actifs de l'entreprise.
export default function KiosqueAccueil() {
  const router = useRouter();
  const [etat, setEtat] = useState("chargement"); // "chargement" | "deconnecte" | "liste"
  const [entrepriseNom, setEntrepriseNom] = useState("");
  const [actifs, setActifs] = useState([]);
  const [promptEvent, setPromptEvent] = useState(null);
  const [installee, setInstallee] = useState(true);
  const [estIOS, setEstIOS] = useState(false);

  useEffect(() => {
    setInstallee(dejaInstallee());
    setEstIOS(detecterIOS());
    function onBeforeInstall(e) {
      e.preventDefault();
      setPromptEvent(e);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (ignore) return;
      if (!session) {
        setEtat("deconnecte");
        return;
      }

      const { entrepriseId: eid, besoinChoix, invitationsEnAttente } = await resoudreEntrepriseActive(supabase);
      if (ignore) return;
      if (invitationsEnAttente > 0) {
        router.replace("/invitations");
        return;
      }
      if (besoinChoix) {
        router.replace("/dashboards?retour=/kiosque");
        return;
      }

      if (eid) {
        const [{ data: ent }, { data: mods }] = await Promise.all([
          supabase.from("entreprises").select("nom").eq("id", eid).maybeSingle(),
          supabase.from("modules_actifs").select("module").eq("entreprise_id", eid),
        ]);
        if (ignore) return;
        setEntrepriseNom(ent?.nom || "");
        setActifs((mods || []).map((m) => m.module));
      }
      setEtat("liste");
    });

    return () => {
      ignore = true;
    };
  }, [router]);

  async function installer() {
    if (!promptEvent) return;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setInstallee(true);
    setPromptEvent(null);
  }

  async function changerDeCompte() {
    await supabase.auth.signOut();
    setEtat("deconnecte");
  }

  if (etat === "chargement") {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>Chargement...</p>
      </div>
    );
  }

  if (etat === "deconnecte") {
    return (
      <div className="kiosk-screen">
        <div className="kiosk-inner" style={{ maxWidth: "460px", width: "100%", textAlign: "center" }}>
          <h1>Gozly Kiosque</h1>
          <p className="panel-hint">Connecte cette tablette au compte Gozly de ton commerce pour afficher tes écrans kiosque.</p>

          <Link href="/login?retour=/kiosque" className="submit-btn" style={{ display: "block", textDecoration: "none", marginTop: "20px" }}>
            Se connecter
          </Link>

          {!installee && (
            <div style={{ marginTop: "28px" }}>
              {promptEvent ? (
                <button type="button" className="admin-icon-btn" style={{ width: "100%" }} onClick={installer}>
                  Installer l&apos;app sur cette tablette
                </button>
              ) : estIOS ? (
                <p className="panel-hint">
                  Pour installer l&apos;app : appuie sur <strong>Partager</strong> en bas de Safari, choisis <strong>« Sur l&apos;écran d&apos;accueil »</strong>, puis <strong>Ajouter</strong>.
                </p>
              ) : (
                <p className="panel-hint">
                  Pour installer l&apos;app : ouvre le menu du navigateur (⋮) et choisis <strong>« Installer l&apos;application »</strong> ou <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong>.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const disponibles = KIOSQUES.filter((k) => actifs.includes(k.module));

  return (
    <div className="kiosk-screen">
      <div className="kiosk-inner" style={{ maxWidth: "720px", width: "100%" }}>
        {entrepriseNom && <p className="kiosk-entreprise">{entrepriseNom}</p>}
        <h1 style={{ textAlign: "center" }}>Choisis un kiosque</h1>

        {disponibles.length === 0 ? (
          <p className="chat-empty">Aucun kiosque disponible : active un module avec « Gérer les modules » dans le dashboard.</p>
        ) : (
          <div className="admin-list">
            {disponibles.map((k) => {
              const module = MODULES.find((m) => m.id === k.module);
              return (
                <Link key={k.id} href={`/kiosque/${k.id}`} className="admin-row" style={{ justifyContent: "flex-start", gap: "14px", textDecoration: "none", color: "inherit" }}>
                  {module?.image ? (
                    <img src={module.image} alt="" width={52} height={52} style={{ flexShrink: 0, borderRadius: "10px" }} />
                  ) : (
                    <span style={{ fontSize: "32px", flexShrink: 0 }}>{module?.icon || <IconEcran className="gozly-icon" />}</span>
                  )}
                  <div className="admin-row-main" style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div className="admin-row-title">{k.nom}</div>
                    <div className="admin-row-sub">{k.description}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <button type="button" className="admin-icon-btn" style={{ marginTop: "24px" }} onClick={changerDeCompte}>
          Changer de compte
        </button>
      </div>
    </div>
  );
}
