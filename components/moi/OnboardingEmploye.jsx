"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeGrids from "@/components/ThemeGrids";
import TransitionTheme from "@/components/moi/TransitionTheme";
import NotificationsPush from "@/components/moi/NotificationsPush";
import { useLangue } from "@/components/moi/LangueContext";
import { LANGUES } from "@/lib/i18n/moi";
import {
  THEME_SOBRE,
  DEFAULT_THEME,
  THEME_STORAGE_KEY_MOI,
  THEME_COULEUR_STORAGE_KEY_MOI,
  isValidTheme,
  couleursDuTheme,
  estSobre,
  DEFAULT_ACCENT,
  THEME_ACCENT_STORAGE_KEY_MOI,
  appliquerAccent,
} from "@/lib/themes";

// Vu une seule fois par appareil, à la toute première connexion (voir
// ConnexionEmploye.jsx) - contrairement au thème/à la langue, ce drapeau
// n'a pas besoin d'être valide/invalide, juste présent ou non.
export const CLE_ONBOARDING_VU_MOI = "gozly_moi_onboarding_vu";

const FILET_SECURITE_MS = 6000;

// Le logo joue en plein écran (mêmes proportions de rognage que le splash
// habituel, voir moi-ouverture.json/.moi-loading-*), puis se rétracte en
// petit bandeau qui reste affiché pendant tout le parcours (langue > thème
// > notifications), au lieu de disparaître comme le fait le splash normal.
export default function OnboardingEmploye() {
  const router = useRouter();
  const { t, langue, setLangue } = useLangue();
  const lottieRef = useRef(null);
  const [logoInstalle, setLogoInstalle] = useState(false);
  const [etape, setEtape] = useState("langue"); // "langue" | "theme" | "notifications"

  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [transition, setTransition] = useState(null);

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(THEME_STORAGE_KEY_MOI);
      if (isValidTheme(cached)) setTheme(cached);
    } catch {}
  }, []);

  useEffect(() => {
    if (!lottieRef.current) return;

    let anim;
    let cancelled = false;

    function installer() {
      setLogoInstalle(true);
    }

    import("lottie-web").then(({ default: lottie }) => {
      if (cancelled || !lottieRef.current) return;
      anim = lottie.loadAnimation({
        container: lottieRef.current,
        renderer: "svg",
        loop: false,
        autoplay: true,
        path: "/animations/moi-bienvenue.json",
      });
      anim.addEventListener("complete", installer);
    });

    const filet = setTimeout(installer, FILET_SECURITE_MS);

    return () => {
      cancelled = true;
      clearTimeout(filet);
      anim?.destroy();
    };
  }, []);

  function appliquerTheme(id) {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY_MOI, id);
      if (!estSobre(id)) window.localStorage.setItem(THEME_COULEUR_STORAGE_KEY_MOI, id);
    } catch {}
  }

  function handleSelectTheme(id) {
    if (id === theme || transition) return;
    setTransition({ id, couleurs: couleursDuTheme(id) });
  }

  function handleSelectAccent(id) {
    setAccent(id);
    appliquerAccent(id);
    try {
      window.localStorage.setItem(THEME_ACCENT_STORAGE_KEY_MOI, id);
    } catch {}
  }

  function handleToggleCouleur(couleur) {
    if (couleur) {
      let dernier = null;
      try {
        dernier = window.localStorage.getItem(THEME_COULEUR_STORAGE_KEY_MOI);
      } catch {}
      handleSelectTheme(isValidTheme(dernier) && !estSobre(dernier) ? dernier : DEFAULT_THEME);
    } else {
      handleSelectTheme(THEME_SOBRE);
    }
  }

  function handleTerminer() {
    try {
      window.localStorage.setItem(CLE_ONBOARDING_VU_MOI, "1");
    } catch {}
    router.replace("/moi/accueil");
  }

  return (
    <div className="moi-onboarding">
      <div className="moi-onboarding-lottie-wrap">
        <div ref={lottieRef} className="moi-onboarding-lottie"></div>
      </div>

      <div className={`moi-onboarding-content${logoInstalle ? " visible" : ""}`}>
        {etape === "langue" && (
          <>
            <h1>{t("onboarding.langueTitre")}</h1>
            <p className="panel-hint">{t("onboarding.langueHint")}</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", margin: "20px 0" }}>
              {LANGUES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="admin-icon-btn"
                  style={langue === l.id ? { borderColor: "var(--violet)", color: "var(--fg)" } : undefined}
                  onClick={() => setLangue(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button type="button" className="submit-btn" style={{ width: "100%" }} onClick={() => setEtape("theme")}>
              {t("onboarding.continuer")}
            </button>
          </>
        )}

        {etape === "theme" && (
          <>
            <h1>{t("onboarding.themeTitre")}</h1>
            <div className="switch-row" style={{ margin: "18px 0" }}>
              <div className="switch-row-text">
                <h4>{t("apparence.couleurTitre")}</h4>
                <p>{t("apparence.couleurDesc")}</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={!estSobre(theme)}
                  disabled={!!transition}
                  onChange={(e) => handleToggleCouleur(e.target.checked)}
                />
                <span className="switch-track"></span>
                <span className="switch-thumb"></span>
              </label>
            </div>

            <ThemeGrids theme={theme} onSelect={handleSelectTheme} disabled={!!transition} accent={accent} onSelectAccent={handleSelectAccent} />

            <button
              type="button"
              className="submit-btn"
              style={{ width: "100%", marginTop: "22px" }}
              onClick={() => setEtape("notifications")}
            >
              {t("onboarding.continuer")}
            </button>

            {transition && (
              <TransitionTheme couleurs={transition.couleurs} onMilieu={() => appliquerTheme(transition.id)} onFin={() => setTransition(null)} />
            )}
          </>
        )}

        {etape === "notifications" && (
          <>
            <h1>{t("onboarding.notifTitre")}</h1>
            <p className="panel-hint">{t("onboarding.notifHint")}</p>
            <div style={{ margin: "18px 0" }}>
              <NotificationsPush />
            </div>
            <button type="button" className="submit-btn" style={{ width: "100%" }} onClick={handleTerminer}>
              {t("onboarding.terminer")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
