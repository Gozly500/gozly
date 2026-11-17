"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ThemeGrids from "@/components/ThemeGrids";
import {
  THEME_SOBRE,
  DEFAULT_THEME,
  THEME_STORAGE_KEY_KIOSQUE,
  THEME_COULEUR_STORAGE_KEY_KIOSQUE,
  isValidTheme,
  couleursDuTheme,
  estSobre,
  DEFAULT_ACCENT,
  THEME_ACCENT_STORAGE_KEY_KIOSQUE,
  isValidAccent,
  appliquerAccent,
} from "@/lib/themes";
import TransitionTheme from "@/components/moi/TransitionTheme";
import { useLangue } from "@/components/moi/LangueContext";
import { LANGUES } from "@/lib/i18n/moi";
import { IconFlecheGauche } from "@/components/icons/Pictogrammes";
import ImprimanteBluetooth from "@/components/ImprimanteBluetooth";
import VerrouillageKiosque from "@/components/kiosque/VerrouillageKiosque";
import ReglageVerrouNip from "@/components/kiosque/ReglageVerrouNip";
import ReglageEpinglerKiosque from "@/components/kiosque/ReglageEpinglerKiosque";
import { effacerVerrouNip } from "@/lib/verrouNip";
import { dansAppKiosque } from "@/lib/appareilKiosque";
import { kiosqueEpingle, surChangementEpingle } from "@/lib/kiosqueEpingle";

// Les réglages sont rangés par catégories, comme dans les réglages de l'app employé et de l'app gestion.
const CATEGORIES = [
  { id: "langue", emoji: "🌐", titre: "kq.langue.titre", desc: "kq.langue.desc" },
  { id: "compte", emoji: "👤", titre: "kq.compte.titre", desc: "kq.cat.compteDesc" },
  { id: "imprimante", emoji: "🖨️", titre: "kq.imp.titre", desc: "kq.cat.imprimanteDesc", seulementApp: true },
  { id: "securite", emoji: "🔒", titre: "kq.cat.securite", desc: "kq.cat.securiteDesc" },
  { id: "apparence", emoji: "🎨", titre: "apparence.titre", desc: "apparence.hint" },
];

// Réglages de la tablette : langue, compte, imprimante, verrouillage, thème (+ accent). Mémorisés sur la tablette seulement.
export default function KiosqueReglages() {
  const { t, langue, setLangue } = useLangue();
  const router = useRouter();
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [transition, setTransition] = useState(null); // { id, couleurs } pendant l'animation
  const [vue, setVue] = useState(null); // null = la liste des catégories
  const [dansApp, setDansApp] = useState(false);
  const [epingle, setEpingle] = useState(null); // kiosque épinglé (on quitte les réglages vers lui)
  const [confirmerSortie, setConfirmerSortie] = useState(false);

  useEffect(() => {
    setDansApp(dansAppKiosque());
    const relire = () => setEpingle(kiosqueEpingle());
    relire();
    return surChangementEpingle(relire);
  }, []);

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(THEME_STORAGE_KEY_KIOSQUE);
      if (isValidTheme(cached)) setTheme(cached);
      const accentCache = window.localStorage.getItem(THEME_ACCENT_STORAGE_KEY_KIOSQUE);
      if (isValidAccent(accentCache)) setAccent(accentCache);
    } catch {}
  }, []);

  function appliquer(id) {
    setTheme(id);
    document.documentElement.dataset.theme = id;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY_KIOSQUE, id);
      if (!estSobre(id)) window.localStorage.setItem(THEME_COULEUR_STORAGE_KEY_KIOSQUE, id);
    } catch {}
  }

  // Le thème ne change qu'au milieu de l'animation, quand le cercle couvre tout l'écran.
  function handleSelect(id) {
    if (id === theme || transition) return;
    setTransition({ id, couleurs: couleursDuTheme(id) });
  }

  function handleSelectAccent(id) {
    setAccent(id);
    appliquerAccent(id);
    try {
      window.localStorage.setItem(THEME_ACCENT_STORAGE_KEY_KIOSQUE, id);
    } catch {}
  }

  const sobre = estSobre(theme);

  // Ferme la session de cette tablette seulement (les autres appareils restent connectés) et revient à la connexion du kiosque.
  async function changerDeCompte() {
    await supabase.auth.signOut({ scope: "local" });
    effacerVerrouNip(); // le NIP est celui de la tablette de ce commerce
    router.push("/kiosque");
  }

  // Case "Couleur" : décochée = mode sobre ; recochée = dernier thème coloré.
  function handleToggleCouleur(couleur) {
    if (couleur) {
      let dernier = null;
      try {
        dernier = window.localStorage.getItem(THEME_COULEUR_STORAGE_KEY_KIOSQUE);
      } catch {}
      handleSelect(isValidTheme(dernier) && !estSobre(dernier) ? dernier : DEFAULT_THEME);
    } else {
      handleSelect(THEME_SOBRE);
    }
  }

  // Retour : d'une catégorie vers la liste ; de la liste vers l'accueil du kiosque. Avec un kiosque épinglé, quitter les
  // réglages mène à ce kiosque et on n'en sort plus : on demande confirmation (pour ne pas fermer les réglages par accident).
  function retour() {
    if (vue) return setVue(null);
    if (epingle) return setConfirmerSortie(true);
    router.push("/kiosque");
  }

  const categorie = CATEGORIES.find((c) => c.id === vue);

  return (
    <div className="wrap" style={{ maxWidth: "720px", padding: "28px 16px 60px" }}>
      <button type="button" className="admin-icon-btn" style={{ display: "inline-flex", gap: "6px", marginBottom: "14px" }} onClick={retour}>
        <IconFlecheGauche className="gozly-icon" /> {t("retour")}
      </button>
      <h2>{categorie ? t(categorie.titre) : t("kq.reglages.titre")}</h2>

      {epingle && !vue && (
        <p className="panel-hint" style={{ color: "#ffd479" }}>
          {t("kq.epingle.actif", { nom: t(`kq.k.${epingle}.nom`) })}
        </p>
      )}

      {!categorie && (
        <>
          <p className="panel-hint">{t("kq.reglages.hint")}</p>
          <div className="moi-settings-list">
            {CATEGORIES.filter((c) => !c.seulementApp || dansApp).map((c) => (
              <button key={c.id} type="button" className="moi-settings-item" onClick={() => setVue(c.id)}>
                <span className="moi-settings-item-emoji">{c.emoji}</span>
                <span className="moi-settings-item-text">
                  <strong>{t(c.titre)}</strong>
                  <span>{t(c.desc)}</span>
                </span>
                <span className="moi-settings-item-chevron">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {vue === "langue" && (
        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          {LANGUES.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`admin-icon-btn${langue === l.id ? " active" : ""}`}
              style={langue === l.id ? { background: "rgba(122,63,224,0.35)", borderColor: "rgba(122,63,224,0.6)" } : undefined}
              onClick={() => setLangue(l.id)}
              aria-pressed={langue === l.id}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {vue === "compte" && (
        <div style={{ marginTop: "16px" }}>
          <p className="panel-hint">{t("kq.compte.desc")}</p>
          <button type="button" className="admin-icon-btn" onClick={changerDeCompte}>
            {t("kq.changerCompte")}
          </button>
        </div>
      )}

      {/* Seulement dans l'app Android du kiosque (le pont Bluetooth n'existe pas dans un navigateur) */}
      {vue === "imprimante" && (
        <div style={{ marginTop: "16px" }}>
          <ImprimanteBluetooth />
        </div>
      )}

      {vue === "securite" && (
        <div style={{ marginTop: "16px" }}>
          <ReglageVerrouNip />
          <ReglageEpinglerKiosque />
          <VerrouillageKiosque />
        </div>
      )}

      {vue === "apparence" && (
        <div style={{ marginTop: "16px" }}>
          <p className="panel-hint">{t("apparence.hint")}</p>

          <div className="switch-row" style={{ marginBottom: "18px" }}>
            <div className="switch-row-text">
              <h4>{t("apparence.couleurTitre")}</h4>
              <p>{t("apparence.couleurDesc")}</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={!sobre} disabled={!!transition} onChange={(e) => handleToggleCouleur(e.target.checked)} />
              <span className="switch-track"></span>
              <span className="switch-thumb"></span>
            </label>
          </div>

          <ThemeGrids theme={theme} onSelect={handleSelect} disabled={!!transition} accent={accent} onSelectAccent={handleSelectAccent} />
        </div>
      )}

      {transition && (
        <TransitionTheme couleurs={transition.couleurs} onMilieu={() => appliquer(transition.id)} onFin={() => setTransition(null)} />
      )}

      {confirmerSortie && epingle && (
        <div className="modal-overlay" onClick={() => setConfirmerSortie(false)}>
          <div className="modal-card" style={{ maxWidth: "440px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <h3>{t("kq.epingle.quitterTitre")}</h3>
            <p style={{ color: "var(--text-dim)" }}>{t("kq.epingle.quitterTexte", { nom: t(`kq.k.${epingle}.nom`) })}</p>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button type="button" className="admin-icon-btn" style={{ flex: 1, padding: "14px" }} onClick={() => setConfirmerSortie(false)}>
                {t("kq.epingle.rester")}
              </button>
              <button type="button" className="submit-btn" style={{ flex: 1, padding: "14px" }} onClick={() => router.push(`/kiosque/${epingle}`)}>
                {t("kq.epingle.quitter")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
