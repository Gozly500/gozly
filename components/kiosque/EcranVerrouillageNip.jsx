"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { resoudreEntrepriseActive } from "@/lib/entreprise";
import { derniereFermeture } from "@/lib/horairesOuverture";
import { useLangue } from "@/components/moi/LangueContext";
import {
  deverrouiller,
  effacerVerrouNip,
  estVerrouille,
  longueurNip,
  nipDefini,
  reglageVerrou,
  surChangementVerrou,
  verifierNip,
  verifierVerrouAuto,
  verrouiller,
} from "@/lib/verrouNip";

const ESSAIS_AVANT_PAUSE = 5;
const PAUSE_SECONDES = 30;

// Écran de verrouillage de la tablette du kiosque : couvre tout l'écran tant que le bon NIP n'est pas entré.
// Le NIP est gardé sur la tablette (voir lib/verrouNip.js) : il se vérifie sans connexion. Se verrouille à la main (petit bouton
// en bas à gauche), à la fermeture du magasin ou à une heure choisie (Réglages du kiosque).
export default function EcranVerrouillageNip() {
  const { t } = useLangue();
  const router = useRouter();
  const [pret, setPret] = useState(false);
  const [aUnNip, setAUnNip] = useState(false);
  const [verrouille, setVerrouille] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState(false);
  const [essais, setEssais] = useState(0);
  const [pauseJusqua, setPauseJusqua] = useState(0);
  const [maintenant, setMaintenant] = useState(Date.now());
  const [oublie, setOublie] = useState(false);
  const emplacementsRef = useRef({ liste: [], id: null, charge: false });

  const relire = useCallback(() => {
    setAUnNip(nipDefini());
    setVerrouille(estVerrouille());
  }, []);

  useEffect(() => {
    relire();
    setPret(true);
    return surChangementVerrou(relire);
  }, [relire]);

  // Heures d'ouverture de la succursale de cette tablette, pour verrouiller à la fermeture (chargées seulement si ce mode est choisi).
  const chargerHoraires = useCallback(async () => {
    if (emplacementsRef.current.charge) return;
    emplacementsRef.current.charge = true;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        emplacementsRef.current.charge = false;
        return;
      }
      const { entrepriseId } = await resoudreEntrepriseActive(supabase);
      if (!entrepriseId) return;
      const { data } = await supabase.from("emplacements").select("*").eq("entreprise_id", entrepriseId);
      let id = null;
      try {
        id = window.localStorage.getItem(`gozly_emplacement_id_${entrepriseId}`);
      } catch {}
      emplacementsRef.current = { liste: data || [], id, charge: true };
    } catch {
      emplacementsRef.current.charge = false; // sans réseau : on réessaiera
    }
  }, []);

  // Verrouillage automatique : vérifié toutes les 20 secondes (et à chaque retour sur l'écran).
  useEffect(() => {
    if (!aUnNip) return;
    async function verifier() {
      const r = reglageVerrou();
      if (!r || r.auto === "jamais") return;
      if (r.auto === "fermeture") await chargerHoraires();
      const { liste, id } = emplacementsRef.current;
      verifierVerrouAuto({ derniereFermeture: r.auto === "fermeture" ? derniereFermeture(liste, id) : null });
    }
    verifier();
    const minuteur = setInterval(verifier, 20000);
    const auRetour = () => document.visibilityState === "visible" && verifier();
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      clearInterval(minuteur);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [aUnNip, chargerHoraires]);

  // Compte à rebours de la pause après trop d'essais ratés.
  useEffect(() => {
    if (pauseJusqua <= Date.now()) return;
    const minuteur = setInterval(() => setMaintenant(Date.now()), 500);
    return () => clearInterval(minuteur);
  }, [pauseJusqua]);

  const secondesRestantes = Math.max(0, Math.ceil((pauseJusqua - maintenant) / 1000));
  const enPause = secondesRestantes > 0;

  async function essayer(nip) {
    if (await verifierNip(nip)) {
      setSaisie("");
      setErreur(false);
      setEssais(0);
      deverrouiller();
      return;
    }
    const n = essais + 1;
    setErreur(true);
    setSaisie("");
    if (n >= ESSAIS_AVANT_PAUSE) {
      setEssais(0);
      const fin = Date.now() + PAUSE_SECONDES * 1000;
      setPauseJusqua(fin);
      setMaintenant(Date.now());
    } else {
      setEssais(n);
    }
  }

  function toucher(chiffre) {
    const longueur = longueurNip();
    if (enPause || saisie.length >= longueur) return;
    const suivant = saisie + chiffre;
    setErreur(false);
    setSaisie(suivant);
    if (suivant.length === longueur) essayer(suivant); // le NIP s'essaie dès qu'il est complet
  }

  async function seDeconnecter() {
    await supabase.auth.signOut({ scope: "local" });
    effacerVerrouNip();
    setOublie(false);
    router.push("/kiosque");
  }

  if (!pret || !aUnNip) return null;

  if (!verrouille) {
    return (
      <button
        type="button"
        onClick={verrouiller}
        aria-label={t("kq.nip.verrouiller")}
        title={t("kq.nip.verrouiller")}
        style={{
          position: "fixed",
          left: "12px",
          bottom: "12px",
          zIndex: 900,
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(20,20,60,0.75)",
          color: "#fff",
          fontSize: "20px",
          cursor: "pointer",
        }}
      >
        🔒
      </button>
    );
  }

  const touches = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "var(--navy, #0b0b2e)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "18px", padding: "24px", touchAction: "manipulation", userSelect: "none" }}
    >
      <div style={{ fontSize: "38px" }}>🔒</div>
      <h2 style={{ margin: 0 }}>{t("kq.nip.titre")}</h2>
      <p style={{ margin: 0, color: erreur ? "#ff9494" : "var(--text-dim, #b9b9d9)", minHeight: "24px", textAlign: "center" }}>
        {enPause ? t("kq.nip.pause", { s: secondesRestantes }) : erreur ? t("kq.nip.mauvais") : t("kq.nip.entre")}
      </p>
      <div style={{ display: "flex", gap: "12px", minHeight: "20px" }}>
        {Array.from({ length: longueurNip() }).map((_, i) => (
          <span key={i} style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2px solid #fff", background: i < saisie.length ? "#fff" : "transparent" }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 84px)", gap: "12px", opacity: enPause ? 0.4 : 1 }}>
        {touches.map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={enPause}
              onClick={() => (k === "⌫" ? setSaisie((s) => s.slice(0, -1)) : toucher(k))}
              aria-label={k === "⌫" ? t("kq.nip.effacer") : k}
              style={{ height: "84px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: "30px", fontWeight: 600, cursor: "pointer" }}
            >
              {k}
            </button>
          )
        )}
      </div>
      <button type="button" className="admin-icon-btn" onClick={() => setOublie(true)}>
        {t("kq.nip.oublie")}
      </button>

      {oublie && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setOublie(false)}>
          <div className="modal-card" style={{ maxWidth: "420px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <h3>{t("kq.nip.oublieTitre")}</h3>
            <p style={{ color: "var(--text-dim)" }}>{t("kq.nip.oublieTexte")}</p>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button type="button" className="admin-icon-btn" style={{ flex: 1, padding: "14px" }} onClick={() => setOublie(false)}>
                {t("kq.nip.annuler")}
              </button>
              <button type="button" className="submit-btn" style={{ flex: 1, padding: "14px" }} onClick={seDeconnecter}>
                {t("kq.nip.deconnecter")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
