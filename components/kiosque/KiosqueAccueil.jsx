"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { MODULES } from "@/lib/modules";
import { KIOSQUES } from "@/lib/kiosques";
import { useLangue } from "@/components/moi/LangueContext";
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
// Les réglages (thème, langue) sont propres à la tablette : /kiosque/reglages.
export default function KiosqueAccueil() {
  const router = useRouter();
  const { t } = useLangue();
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

  const lienReglages = (
    <Link href="/kiosque/reglages" className="admin-icon-btn" style={{ display: "inline-flex", textDecoration: "none" }}>
      {t("kq.reglages")}
    </Link>
  );

  if (etat === "chargement") {
    return (
      <div className="wrap" style={{ padding: "160px 0", textAlign: "center" }}>
        <p style={{ color: "var(--text-dim)" }}>{t("kq.chargement")}</p>
      </div>
    );
  }

  if (etat === "deconnecte") {
    return (
      <div className="kiosk-screen">
        <div className="kiosk-inner" style={{ maxWidth: "460px", width: "100%", textAlign: "center" }}>
          <h1>{t("kq.titre")}</h1>
          <p className="panel-hint">{t("kq.hintConnexion")}</p>

          <Link href="/login?retour=/kiosque" className="submit-btn" style={{ display: "block", textDecoration: "none", marginTop: "20px" }}>
            {t("kq.seConnecter")}
          </Link>

          {!installee && (
            <div style={{ marginTop: "28px" }}>
              {promptEvent ? (
                <button type="button" className="admin-icon-btn" style={{ width: "100%" }} onClick={installer}>
                  {t("kq.installer")}
                </button>
              ) : (
                <p className="panel-hint">{estIOS ? t("kq.installerIOS") : t("kq.installerAndroid")}</p>
              )}
            </div>
          )}

          <div style={{ marginTop: "24px" }}>{lienReglages}</div>
        </div>
      </div>
    );
  }

  const disponibles = KIOSQUES.filter((k) => actifs.includes(k.module));

  return (
    <div className="kiosk-screen">
      <div className="kiosk-inner" style={{ maxWidth: "720px", width: "100%" }}>
        {entrepriseNom && <p className="kiosk-entreprise">{entrepriseNom}</p>}
        <h1 style={{ textAlign: "center" }}>{t("kq.choisir")}</h1>

        {disponibles.length === 0 ? (
          <p className="chat-empty">{t("kq.aucunKiosque")}</p>
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
                    <div className="admin-row-title">{t(`kq.k.${k.id}.nom`)}</div>
                    <div className="admin-row-sub">{t(`kq.k.${k.id}.desc`)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {lienReglages}
          <button type="button" className="admin-icon-btn" onClick={changerDeCompte}>
            {t("kq.changerCompte")}
          </button>
        </div>
      </div>
    </div>
  );
}
